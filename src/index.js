const canvas = typeof document !== "undefined"
    ? document.getElementById("cnvs")
    : null;

const gameState = {};

class QuadTree {
    constructor(bounds, capacity = 16) {
        this.bounds = bounds; // { minX, minY, maxX, maxY }
        this.capacity = capacity;
        this.shapes = [];
        this.divided = false;
        this.children = [];
    }

    clear() {
        this.shapes = [];
        this.divided = false;
        this.children = [];
    }

    insert(shape) {
        const b = this.bounds;
        const a = shape.aabb;
        if (a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY) return false;

        if (this.shapes.length < this.capacity && !this.divided) {
            this.shapes.push(shape);
            return true;
        }

        if (!this.divided) this.subdivide();

        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i].insert(shape)) return true;
        }
        return false;
    }

    subdivide() {
        const b = this.bounds;
        const midX = (b.minX + b.maxX) / 2;
        const midY = (b.minY + b.maxY) / 2;

        this.children = [
            new QuadTree({ minX: b.minX, minY: b.minY, maxX: midX, maxY: midY }, this.capacity),
            new QuadTree({ minX: midX, minY: b.minY, maxX: b.maxX, maxY: midY }, this.capacity),
            new QuadTree({ minX: b.minX, minY: midY, maxX: midX, maxY: b.maxY }, this.capacity),
            new QuadTree({ minX: midX, minY: midY, maxX: b.maxX, maxY: b.maxY }, this.capacity)
        ];
        this.divided = true;

        const shapes = this.shapes;
        for (let i = 0; i < shapes.length; i++) {
            const s = shapes[i];
            for (let j = 0; j < this.children.length; j++) {
                if (this.children[j].insert(s)) break;
            }
        }
        this.shapes = [];
    }

    queryRange(aabb, result = []) {
        const b = this.bounds;
        if (aabb.maxX < b.minX || aabb.minX > b.maxX || aabb.maxY < b.minY || aabb.minY > b.maxY) return result;

        if (this.divided) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].queryRange(aabb, result);
            }
        } else {
            const shapes = this.shapes;
            for (let i = 0; i < shapes.length; i++) {
                const s = shapes[i];
                const sa = s.aabb;
                if (!(sa.maxX < aabb.minX || sa.minX > aabb.maxX || sa.maxY < aabb.minY || sa.minY > aabb.maxY)) {
                    result.push(s);
                }
            }
        }
        return result;
    }
}


function projectPolygon(verts, axis, out) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < verts.length; i += 2) {
        const dot = verts[i] * axis.x + verts[i+1] * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    out.min = min;
    out.max = max;
}

function projectCircle(circle, axis, out) {
    const dot = circle.x * axis.x + circle.y * axis.y;
    out.min = dot - circle.size;
    out.max = dot + circle.size;
}

function polygonPolygonSAT(polyA, polyB) {
    let overlap = Infinity;
    let smallestAxis = null;

    const vertsA = polyA.vertices;
    const vertsB = polyB.vertices;
    const projA = { min: 0, max: 0 };
    const projB = { min: 0, max: 0 };

    // axes from A
    for (let i = 0; i < vertsA.length; i += 2) {
        const j = (i + 2) % vertsA.length;
        const edgeX = vertsA[j] - vertsA[i];
        const edgeY = vertsA[j+1] - vertsA[i+1];
        let axisX = edgeY;
        let axisY = -edgeX;
        const lenSq = axisX*axisX + axisY*axisY;
        if (lenSq === 0) continue;
        const len = Math.sqrt(lenSq);
        axisX /= len;
        axisY /= len;

        projectPolygon(vertsA, {x: axisX, y: axisY}, projA);
        projectPolygon(vertsB, {x: axisX, y: axisY}, projB);
        const o = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
        if (o < 0) return null;
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axisX, y: axisY };
        }
    }

    for (let i = 0; i < vertsB.length; i += 2) {
        const j = (i + 2) % vertsB.length;
        const edgeX = vertsB[j] - vertsB[i];
        const edgeY = vertsB[j+1] - vertsB[i+1];
        let axisX = edgeY;
        let axisY = -edgeX;
        const lenSq = axisX*axisX + axisY*axisY;
        if (lenSq === 0) continue;
        const len = Math.sqrt(lenSq);
        axisX /= len;
        axisY /= len;

        projectPolygon(vertsA, {x: axisX, y: axisY}, projA);
        projectPolygon(vertsB, {x: axisX, y: axisY}, projB);
        const o = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
        if (o < 0) return null;
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axisX, y: axisY };
        }
    }

    return { axis: smallestAxis, depth: overlap };
}

function circleCircleSAT(circA, circB) {
    const dx = circB.x - circA.x;
    const dy = circB.y - circA.y;
    const distSq = dx*dx + dy*dy;
    const radiusSum = circA.size + circB.size;
    if (distSq >= radiusSum * radiusSum) return null;

    const dist = Math.sqrt(distSq);
    const depth = radiusSum - dist;
    let normalX = dx / dist;
    let normalY = dy / dist;
    if (dist === 0) {
        normalX = 1;
        normalY = 0;
    }
    return { axis: { x: normalX, y: normalY }, depth };
}

function circlePolygonSAT(circle, poly) {
    let overlap = Infinity;
    let smallestAxis = null;
    const verts = poly.vertices;
    const projPoly = { min: 0, max: 0 };
    const projCircle = { min: 0, max: 0 };

    for (let i = 0; i < verts.length; i += 2) {
        const j = (i + 2) % verts.length;
        const edgeX = verts[j] - verts[i];
        const edgeY = verts[j+1] - verts[i+1];
        let axisX = edgeY;
        let axisY = -edgeX;
        const lenSq = axisX*axisX + axisY*axisY;
        if (lenSq === 0) continue;
        const len = Math.sqrt(lenSq);
        axisX /= len;
        axisY /= len;

        projectPolygon(verts, {x: axisX, y: axisY}, projPoly);
        projectCircle(circle, {x: axisX, y: axisY}, projCircle);
        const o = Math.min(projPoly.max, projCircle.max) - Math.max(projPoly.min, projCircle.min);
        if (o < 0) return null;
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axisX, y: axisY };
        }
    }

    for (let i = 0; i < verts.length; i += 2) {
        const vx = verts[i];
        const vy = verts[i+1];
        let axisX = vx - circle.x;
        let axisY = vy - circle.y;
        const lenSq = axisX*axisX + axisY*axisY;
        if (lenSq === 0) continue;
        const len = Math.sqrt(lenSq);
        axisX /= len;
        axisY /= len;

        projectPolygon(verts, {x: axisX, y: axisY}, projPoly);
        projectCircle(circle, {x: axisX, y: axisY}, projCircle);
        const o = Math.min(projPoly.max, projCircle.max) - Math.max(projPoly.min, projCircle.min);
        if (o < 0) return null;
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axisX, y: axisY };
        }
    }

    return { axis: smallestAxis, depth: overlap };
}

function satCollision(a, b) {
    let result = null;
    if (a.type === 'circle' && b.type === 'circle') {
        result = circleCircleSAT(a, b);
    } else if (a.type === 'circle' && b.type !== 'circle') {
        result = circlePolygonSAT(a, b);
    } else if (a.type !== 'circle' && b.type === 'circle') {
        result = circlePolygonSAT(b, a);
        if (result) {
            result.axis.x *= -1;
            result.axis.y *= -1;
        }
    } else {
        result = polygonPolygonSAT(a, b);
    }

    if (!result) return null;

    const dirX = b.x - a.x;
    const dirY = b.y - a.y;
    if (dirX * result.axis.x + dirY * result.axis.y < 0) {
        result.axis.x *= -1;
        result.axis.y *= -1;
    }

    return { normal: result.axis, depth: result.depth };
}

function queueUpdates(numTicks) {
    for (let i = 0; i < numTicks; i++) {
        gameState.lastTick = gameState.lastTick + gameState.tickLength;
        update(gameState.lastTick);
    }
}

function draw() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, gameState.world.width, gameState.world.height);

    const shapes = gameState.shapes;
    for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#ffffff';

        if (s.type === 'circle') {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        } else {
            const verts = s.vertices;
            ctx.beginPath();
            ctx.moveTo(verts[0], verts[1]);
            for (let j = 2; j < verts.length; j += 2) {
                ctx.lineTo(verts[j], verts[j+1]);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
}

function recomputeAll() {
    const shapes = gameState.shapes;
    for (let i = 0; i < shapes.length; i++) {
        computeVerticesAndAABB(shapes[i]);
    }
}

function resolveCollision(a, b, normal, depth) {
    const correctionX = normal.x * depth * 0.5;
    const correctionY = normal.y * depth * 0.5;
    a.x -= correctionX;
    a.y -= correctionY;
    b.x += correctionX;
    b.y += correctionY;

    const vRel = (b.vx - a.vx) * normal.x + (b.vy - a.vy) * normal.y;
    if (vRel > 0) return;

    const impulse = -vRel;
    a.vx -= impulse * normal.x;
    a.vy -= impulse * normal.y;
    b.vx += impulse * normal.x;
    b.vy += impulse * normal.y;
}

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

    for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.angle += s.omega * dt;
    }

    recomputeAll();

    const iterations = 1;
    const worldBounds = gameState.worldBounds;

    for (let iter = 0; iter < iterations; iter++) {
        const qt = gameState.quadTree;
        qt.clear();
        for (let i = 0; i < shapes.length; i++) {
            qt.insert(shapes[i]);
        }

        for (let i = 0; i < shapes.length; i++) {
            const shapeA = shapes[i];
            const candidates = qt.queryRange(shapeA.aabb);
            for (let j = 0; j < candidates.length; j++) {
                const shapeB = candidates[j];
                if (shapeB.index <= i) continue;
                const coll = satCollision(shapeA, shapeB);
                if (coll) {
                    resolveCollision(shapeA, shapeB, coll.normal, coll.depth);
                }
            }
        }

        for (let i = 0; i < shapes.length; i++) {
            handleWalls(shapes[i]);
        }

        recomputeAll();
    }
}

function run(tFrame) {
    gameState.stopCycle = window.requestAnimationFrame(run);

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
        document.getElementById('fps').innerHTML = `⏱️ ${gameState.fps} fps`;
    }

    const nextTick = gameState.lastTick + gameState.tickLength;
    let numTicks = 0;
    if (tFrame > nextTick) {
        const timeSinceTick = tFrame - gameState.lastTick;
        numTicks = Math.floor(timeSinceTick / gameState.tickLength);
    }

    queueUpdates(numTicks);
    draw();
}

function computeVerticesAndAABB(shape) {
    const aabb = shape.aabb;
    if (shape.type === 'circle') {
        const r = shape.size;
        aabb.minX = shape.x - r;
        aabb.minY = shape.y - r;
        aabb.maxX = shape.x + r;
        aabb.maxY = shape.y + r;
        return;
    }

    let verts = shape.vertices;
    if (shape.type === 'triangle') {
        const side = 2 * shape.size;
        const radius = side / Math.sqrt(3);
        const angle = shape.angle;
        const x0 = shape.x, y0 = shape.y;
        // reuse or create array of length 6
        if (!verts || verts.length !== 6) verts = shape.vertices = new Array(6);
        for (let i = 0; i < 3; i++) {
            const ang = angle + i * 2 * Math.PI / 3;
            verts[i*2] = x0 + radius * Math.cos(ang);
            verts[i*2+1] = y0 + radius * Math.sin(ang);
        }
    } else { // square
        const half = shape.size;
        const cos = Math.cos(shape.angle);
        const sin = Math.sin(shape.angle);
        const x0 = shape.x, y0 = shape.y;
        const local = [
            half, half,
            -half, half,
            -half, -half,
            half, -half
        ];
        if (!verts || verts.length !== 8) verts = shape.vertices = new Array(8);
        for (let i = 0; i < 8; i += 2) {
            const lx = local[i];
            const ly = local[i+1];
            const xr = lx * cos - ly * sin;
            const yr = lx * sin + ly * cos;
            verts[i] = x0 + xr;
            verts[i+1] = y0 + yr;
        }
    }
    shape.vertices = verts;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < verts.length; i += 2) {
        const vx = verts[i];
        const vy = verts[i+1];
        if (vx < minX) minX = vx;
        if (vy < minY) minY = vy;
        if (vx > maxX) maxX = vx;
        if (vy > maxY) maxY = vy;
    }
    aabb.minX = minX;
    aabb.minY = minY;
    aabb.maxX = maxX;
    aabb.maxY = maxY;
}

gameState.world = { width: 1200, height: 800 };
gameState.worldBounds = { minX: 0, minY: 0, maxX: 1200, maxY: 800 };

function initShapes(count) {
    const newShapes = [];
    const types = ['circle', 'triangle', 'square'];
    const cfg = gameState.CONFIG;
    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.random() * (gameState.world.width - 2 * cfg.SHAPE_SIZE) + cfg.SHAPE_SIZE;
        const y = Math.random() * (gameState.world.height - 2 * cfg.SHAPE_SIZE) + cfg.SHAPE_SIZE;
        const angle = Math.random() * 2 * Math.PI;
        const speed = cfg.MIN_SPEED + Math.random() * (cfg.MAX_SPEED - cfg.MIN_SPEED);
        const dir = Math.random() * 2 * Math.PI;
        const vx = Math.cos(dir) * speed;
        const vy = Math.sin(dir) * speed;
        const omega = cfg.MIN_OMEGA + Math.random() * (cfg.MAX_OMEGA - cfg.MIN_OMEGA);
        const color = cfg.COLORS[Math.floor(Math.random() * cfg.COLORS.length)];

        const shape = {
            type,
            x, y,
            vx, vy,
            angle,
            omega,
            size: cfg.SHAPE_SIZE,
            color,
            index: i,
            vertices: type === 'circle' ? null : [],
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
        SHAPE_SIZE: 3,
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
    gameState.quadTree = new QuadTree(gameState.worldBounds, 16);

    document.getElementById('shapeCount').innerHTML = `🔷 ${gameState.CONFIG.NUM_SHAPES}`;

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
        satCollision,
        resolveCollision,
        handleWalls,
        computeVerticesAndAABB,
        initShapes,
        queueUpdates,
        update,
        gameState
    };
}