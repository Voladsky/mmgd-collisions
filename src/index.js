const canvas = typeof document !== "undefined"
    ? document.getElementById("cnvs")
    : null;

const gameState = {};

function queueUpdates(numTicks) {
    for (let i = 0; i < numTicks; i++) {
        gameState.lastTick = gameState.lastTick + gameState.tickLength
        update(gameState.lastTick)
    }
}

function draw() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, gameState.world.width, gameState.world.height);

    for (let s of gameState.shapes) {

        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#ffffff';

        if (s.type === 'circle') {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(s.vertices[0].x, s.vertices[0].y);
            for (let k = 1; k < s.vertices.length; k++) {
                ctx.lineTo(s.vertices[k].x, s.vertices[k].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
}

function recomputeAll() {
    for (let s of gameState.shapes) {
        computeVerticesAndAABB(s);
    }
}

function aabbCollision(a, b) {
    const aa = a.aabb, bb = b.aabb;

    // проверка перекрытия
    if (aa.maxX < bb.minX || aa.minX > bb.maxX ||
        aa.maxY < bb.minY || aa.minY > bb.maxY) {
        return null;
    }

    // глубина проникновения по X и Y (положительные числа)
    const overlapX = Math.min(aa.maxX, bb.maxX) - Math.max(aa.minX, bb.minX);
    const overlapY = Math.min(aa.maxY, bb.maxY) - Math.max(aa.minY, bb.minY);

    // выбираем ось с наименьшим перекрытием (нормаль будет вдоль этой оси)
    if (overlapX < overlapY) {
        // нормаль по X: направление от A к B
        const normalX = (aa.minX < bb.minX) ? 1 : -1;
        return { normal: { x: normalX, y: 0 }, depth: overlapX };
    } else {
        // нормаль по Y
        const normalY = (aa.minY < bb.minY) ? 1 : -1;
        return { normal: { x: 0, y: normalY }, depth: overlapY };
    }
}

// ---------- разрешение столкновения (упругое, равные массы) ----------
function resolveCollision(a, b, normal, depth) {
    // Раздвигаем фигуры
    const correctionX = normal.x * depth * 0.5;
    const correctionY = normal.y * depth * 0.5;
    a.x -= correctionX;
    a.y -= correctionY;
    b.x += correctionX;
    b.y += correctionY;

    // Относительная скорость вдоль нормали
    const vRel = (b.vx - a.vx) * normal.x + (b.vy - a.vy) * normal.y;

    // Если объекты уже разлетаются, ничего не делаем
    if (vRel > 0) return;

    // ПРАВИЛЬНЫЙ импульс для упругого столкновения (коэффициент восстановления = 1)
    // Для равных масс: обмен скоростями вдоль нормали
    const impulse = -vRel; // Полный обмен, энергия сохраняется

    // Применяем импульс
    a.vx -= impulse * normal.x;
    a.vy -= impulse * normal.y;
    b.vx += impulse * normal.x;
    b.vy += impulse * normal.y;
}

// ---------- столкновения с границами экрана (на основе AABB) ----------
function handleWalls(shape) {
    const aabb = shape.aabb;
    let dx = 0, dy = 0;
    if (aabb.minX < 0) dx = -aabb.minX;
    else if (aabb.maxX > gameState.world.width) dx = gameState.world.width - aabb.maxX;

    if (aabb.minY < 0) dy = -aabb.minY;
    else if (aabb.maxY > gameState.world.height) dy = gameState.world.height - aabb.maxY;

    if (dx !== 0) {
        shape.x += dx;
        shape.vx = -shape.vx;
    }
    if (dy !== 0) {
        shape.y += dy;
        shape.vy = -shape.vy;
    }
}

function update(lastTick) {

    const dt = gameState.tickLength / 1000;
    const shapes = gameState.shapes;
    // 1. movement
    for (let s of shapes) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.angle += s.omega * dt;
    }

    recomputeAll();

    const iterations = 2;

    for (let iter = 0; iter < iterations; iter++) {

        for (let i = 0; i < shapes.length; i++) {
            for (let j = i + 1; j < shapes.length; j++) {
                const coll = aabbCollision(shapes[i], shapes[j]);
                if (coll) {
                    resolveCollision(shapes[i], shapes[j], coll.normal, coll.depth);
                }
            }
        }

        for (let s of shapes) {
            handleWalls(s);
        }

        recomputeAll();
    }
}


function run(tFrame) {
    gameState.stopCycle = window.requestAnimationFrame(run);

    // --- FPS CALCULATION ---
    if (!gameState.lastRender) {
        gameState.lastRender = tFrame;
    }

    const deltaRender = tFrame - gameState.lastRender;

    gameState.lastRender = tFrame;

    gameState.fpsTimer += deltaRender;

    gameState.frameCount++;

    if (gameState.fpsTimer >= 1000) {
        gameState.fps = gameState.frameCount;
        gameState.frameCount = 0;
        gameState.fpsTimer = 0;

        document.getElementById('fps').innerHTML =
            `⏱️ ${gameState.fps} fps`;
    }

    // --- FIXED TIMESTEP PART ---
    const nextTick = gameState.lastTick + gameState.tickLength;
    let numTicks = 0;

    if (tFrame > nextTick) {
        const timeSinceTick = tFrame - gameState.lastTick;
        numTicks = Math.floor(timeSinceTick / gameState.tickLength);
    }

    queueUpdates(numTicks);
    draw();
}


function stopGame(handle) {
    window.cancelAnimationFrame(handle);
}

function computeVerticesAndAABB(shape) {
    if (shape.type === 'circle') {
        // AABB для круга — описанный квадрат
        const r = shape.size;
        shape.aabb = {
            minX: shape.x - r,
            minY: shape.y - r,
            maxX: shape.x + r,
            maxY: shape.y + r
        };
        return;
    }

    // многоугольник: вершины в мировых координатах
    const verts = [];
    if (shape.type === 'triangle') {
        const side = 2 * shape.size;
        const radius = side / Math.sqrt(3); // circumradius

        for (let i = 0; i < 3; i++) {
            const ang = shape.angle + i * 2 * Math.PI / 3;
            verts.push({
                x: shape.x + radius * Math.cos(ang),
                y: shape.y + radius * Math.sin(ang)
            });
        }

    } else { // square
        const half = shape.size;
        const local = [
            { x: half, y: half },
            { x: -half, y: half },
            { x: -half, y: -half },
            { x: half, y: -half }
        ];
        for (let p of local) {
            // простой поворот вокруг центра
            const cos = Math.cos(shape.angle);
            const sin = Math.sin(shape.angle);
            const xr = p.x * cos - p.y * sin;
            const yr = p.x * sin + p.y * cos;
            verts.push({ x: shape.x + xr, y: shape.y + yr });
        }
    }
    shape.vertices = verts;

    // AABB по вершинам
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let v of verts) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
    }
    shape.aabb = { minX, minY, maxX, maxY };
}

gameState.world = {
    width: 1200,
    height: 800
};


function initShapes(count) {
    const newShapes = [];
    const types = ['circle', 'triangle', 'square'];
    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.random() * (gameState.world.width - 2 * gameState.CONFIG.SHAPE_SIZE) + gameState.CONFIG.SHAPE_SIZE;
        const y = Math.random() * (gameState.world.height - 2 * gameState.CONFIG.SHAPE_SIZE) + gameState.CONFIG.SHAPE_SIZE;
        const angle = Math.random() * 2 * Math.PI;
        const speed = gameState.CONFIG.MIN_SPEED + Math.random() * (gameState.CONFIG.MAX_SPEED - gameState.CONFIG.MIN_SPEED);
        const dir = Math.random() * 2 * Math.PI;
        const vx = Math.cos(dir) * speed;
        const vy = Math.sin(dir) * speed;
        const omega = gameState.CONFIG.MIN_OMEGA + Math.random() * (gameState.CONFIG.MAX_OMEGA - gameState.CONFIG.MIN_OMEGA);
        const color = gameState.CONFIG.COLORS[Math.floor(Math.random() * gameState.CONFIG.COLORS.length)];

        const shape = {
            type,
            x, y,
            vx, vy,
            angle,
            omega,
            size: gameState.CONFIG.SHAPE_SIZE,
            color,
            vertices: [],
            aabb: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
        };
        computeVerticesAndAABB(shape);
        newShapes.push(shape);
    }
    return newShapes;
}

function setup() {
    gameState.CONFIG = {
        NUM_SHAPES: 900,
        SHAPE_SIZE: 4,
        MIN_SPEED: 40,
        MAX_SPEED: 160,
        MIN_OMEGA: -3.0,
        MAX_OMEGA: 3.0,
        COLORS: ['#f72585', '#b5179e', '#7209b7', '#560bad', '#480ca8', '#3a0ca3', '#3f37c9', '#4361ee', '#4895ef', '#4cc9f0']
    };
    gameState.lastTick = performance.now();
    gameState.lastRender = performance.now();
    gameState.tickLength = 15;

    gameState.fps = 0;
    gameState.frameCount = 0;
    gameState.fpsTimer = 0;

    gameState.shapes = initShapes(gameState.CONFIG.NUM_SHAPES);

    document.getElementById('shapeCount').innerHTML = `🔷 ${gameState.CONFIG.NUM_SHAPES}`;
    
    // Add slider functionality
    const shapeSlider = document.getElementById('shapeSlider');
    const sliderValue = document.getElementById('sliderValue');
    
    shapeSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        sliderValue.textContent = value;
        gameState.CONFIG.NUM_SHAPES = parseInt(value);
        document.getElementById('shapeCount').innerHTML = `🔷 ${value}`;
    });

    document.getElementById('restartBtn').addEventListener('click', () => {
        gameState.shapes = initShapes(gameState.CONFIG.NUM_SHAPES);
    });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
    setup();
    requestAnimationFrame(run);
}

if (typeof module !== "undefined") {
    module.exports = {
        aabbCollision,
        resolveCollision,
        handleWalls,
        computeVerticesAndAABB,
        initShapes,
        queueUpdates,
        update,
        gameState
    };
}

