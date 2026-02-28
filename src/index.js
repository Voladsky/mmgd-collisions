const canvas = typeof document !== "undefined"
    ? document.getElementById("cnvs")
    : null;

const gameState = {};

// ==================== QuadTree Implementation ====================
class QuadTree {
    constructor(bounds, capacity = 8) {
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
        if (!this.intersects(shape.aabb, this.bounds)) return false;

        if (this.shapes.length < this.capacity && !this.divided) {
            this.shapes.push(shape);
            return true;
        }

        if (!this.divided) this.subdivide();

        for (let child of this.children) {
            if (child.insert(shape)) return true;
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

        // Re‑insert existing shapes into children
        for (let s of this.shapes) {
            for (let child of this.children) {
                if (child.insert(s)) break;
            }
        }
        this.shapes = [];
    }

    queryRange(aabb, result = []) {
        if (!this.intersects(aabb, this.bounds)) return result;

        if (this.divided) {
            for (let child of this.children) {
                child.queryRange(aabb, result);
            }
        } else {
            for (let s of this.shapes) {
                if (this.intersects(s.aabb, aabb)) {
                    result.push(s);
                }
            }
        }
        return result;
    }

    intersects(a, b) {
        return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
    }
}

// ==================== SAT Collision Helpers ====================
function projectPolygon(vertices, axis) {
    let min = Infinity, max = -Infinity;
    for (let v of vertices) {
        const dot = v.x * axis.x + v.y * axis.y;
        min = Math.min(min, dot);
        max = Math.max(max, dot);
    }
    return { min, max };
}

function projectCircle(circle, axis) {
    const centerDot = circle.x * axis.x + circle.y * axis.y;
    return { min: centerDot - circle.size, max: centerDot + circle.size };
}

function polygonPolygonSAT(polyA, polyB) {
    let overlap = Infinity;
    let smallestAxis = null;

    const verticesA = polyA.vertices;
    const verticesB = polyB.vertices;

    // Axes from polyA
    for (let i = 0; i < verticesA.length; i++) {
        const j = (i + 1) % verticesA.length;
        const edge = {
            x: verticesA[j].x - verticesA[i].x,
            y: verticesA[j].y - verticesA[i].y
        };
        let axis = { x: edge.y, y: -edge.x };
        const len = Math.hypot(axis.x, axis.y);
        if (len === 0) continue;
        axis.x /= len; axis.y /= len;

        const projA = projectPolygon(verticesA, axis);
        const projB = projectPolygon(verticesB, axis);
        const o = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
        if (o < 0) return null; // separation
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axis.x, y: axis.y };
        }
    }

    // Axes from polyB
    for (let i = 0; i < verticesB.length; i++) {
        const j = (i + 1) % verticesB.length;
        const edge = {
            x: verticesB[j].x - verticesB[i].x,
            y: verticesB[j].y - verticesB[i].y
        };
        let axis = { x: edge.y, y: -edge.x };
        const len = Math.hypot(axis.x, axis.y);
        if (len === 0) continue;
        axis.x /= len; axis.y /= len;

        const projA = projectPolygon(verticesA, axis);
        const projB = projectPolygon(verticesB, axis);
        const o = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
        if (o < 0) return null;
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axis.x, y: axis.y };
        }
    }

    return { axis: smallestAxis, depth: overlap };
}

function circleCircleSAT(circA, circB) {
    const dx = circB.x - circA.x;
    const dy = circB.y - circA.y;
    const dist = Math.hypot(dx, dy);
    const radiusSum = circA.size + circB.size;
    if (dist >= radiusSum) return null;

    const depth = radiusSum - dist;
    let normal = { x: dx / dist, y: dy / dist };
    if (dist === 0) {
        normal = { x: 1, y: 0 }; // arbitrary
    }
    // normal already points from A to B
    return { axis: normal, depth };
}

function circlePolygonSAT(circle, poly) {
    let overlap = Infinity;
    let smallestAxis = null;
    const vertices = poly.vertices;

    // Axes from polygon edges
    for (let i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        const edge = {
            x: vertices[j].x - vertices[i].x,
            y: vertices[j].y - vertices[i].y
        };
        let axis = { x: edge.y, y: -edge.x };
        const len = Math.hypot(axis.x, axis.y);
        if (len === 0) continue;
        axis.x /= len; axis.y /= len;

        const projPoly = projectPolygon(vertices, axis);
        const projCircle = projectCircle(circle, axis);
        const o = Math.min(projPoly.max, projCircle.max) - Math.max(projPoly.min, projCircle.min);
        if (o < 0) return null;
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axis.x, y: axis.y };
        }
    }

    // Axes from circle center to polygon vertices
    for (let v of vertices) {
        let axis = { x: v.x - circle.x, y: v.y - circle.y };
        const len = Math.hypot(axis.x, axis.y);
        if (len === 0) continue;
        axis.x /= len; axis.y /= len;

        const projPoly = projectPolygon(vertices, axis);
        const projCircle = projectCircle(circle, axis);
        const o = Math.min(projPoly.max, projCircle.max) - Math.max(projPoly.min, projCircle.min);
        if (o < 0) return null;
        if (o < overlap) {
            overlap = o;
            smallestAxis = { x: axis.x, y: axis.y };
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
            // flip because we want normal from a (poly) to b (circle)
            result.axis.x *= -1;
            result.axis.y *= -1;
        }
    } else {
        result = polygonPolygonSAT(a, b);
    }

    if (!result) return null;

    // Ensure normal points from a to b
    const dir = { x: b.x - a.x, y: b.y - a.y };
    if (dir.x * result.axis.x + dir.y * result.axis.y < 0) {
        result.axis.x *= -1;
        result.axis.y *= -1;
    }

    return { normal: result.axis, depth: result.depth };
}

// ==================== Existing Helper Functions ====================
function queueUpdates(numTicks) {
    for (let i = 0; i < numTicks; i++) {
        gameState.lastTick = gameState.lastTick + gameState.tickLength;
        update(gameState.lastTick);
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

// ==================== Updated Update Function ====================
function update(lastTick) {
    const dt = gameState.tickLength / 1000;
    const shapes = gameState.shapes;

    for (let s of shapes) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.angle += s.omega * dt;
    }

    recomputeAll();

    const iterations = 2;
    const worldBounds = {
        minX: 0,
        minY: 0,
        maxX: gameState.world.width,
        maxY: gameState.world.height
    };

    for (let iter = 0; iter < iterations; iter++) {
        // Build quadtree for broad phase
        const qt = new QuadTree(worldBounds, 4);
        for (let s of shapes) {
            qt.insert(s);
        }

        // Narrow phase with SAT
        for (let i = 0; i < shapes.length; i++) {
            const shapeA = shapes[i];
            const candidates = qt.queryRange(shapeA.aabb);
            for (let shapeB of candidates) {
                if (shapeB.index <= i) continue; // avoid duplicate pairs and self
                const coll = satCollision(shapeA, shapeB);
                if (coll) {
                    resolveCollision(shapeA, shapeB, coll.normal, coll.depth);
                }
            }
        }

        // Wall handling
        for (let s of shapes) {
            handleWalls(s);
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
    if (shape.type === 'circle') {
        const r = shape.size;
        shape.aabb = {
            minX: shape.x - r,
            minY: shape.y - r,
            maxX: shape.x + r,
            maxY: shape.y + r
        };
        return;
    }

    const verts = [];
    if (shape.type === 'triangle') {
        const side = 2 * shape.size;
        const radius = side / Math.sqrt(3);

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
            const cos = Math.cos(shape.angle);
            const sin = Math.sin(shape.angle);
            const xr = p.x * cos - p.y * sin;
            const yr = p.x * sin + p.y * cos;
            verts.push({ x: shape.x + xr, y: shape.y + yr });
        }
    }
    shape.vertices = verts;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let v of verts) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
    }
    shape.aabb = { minX, minY, maxX, maxY };
}

gameState.world = { width: 1200, height: 800 };

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
            index: i, // store index for duplicate avoidance
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
        // Export updated functions if needed for testing
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