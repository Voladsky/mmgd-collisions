const {
    aabbCollision,
    resolveCollision,
    handleWalls,
    computeVerticesAndAABB,
    initShapes,
    queueUpdates,
    update,
    gameState
} = require('./index.js'); // change path

describe("AABB Collision Detection", () => {

    test("detects overlapping boxes", () => {
        const a = { aabb: { minX: 0, minY: 0, maxX: 10, maxY: 10 } };
        const b = { aabb: { minX: 5, minY: 5, maxX: 15, maxY: 15 } };

        const result = aabbCollision(a, b);
        expect(result).not.toBeNull();
        expect(result.depth).toBeGreaterThan(0);
    });

    test("returns null when no overlap", () => {
        const a = { aabb: { minX: 0, minY: 0, maxX: 10, maxY: 10 } };
        const b = { aabb: { minX: 20, minY: 20, maxX: 30, maxY: 30 } };

        const result = aabbCollision(a, b);
        expect(result).toBeNull();
    });
});

describe("Collision Resolution", () => {

    test("swaps velocity on head-on collision (equal mass)", () => {
        const a = { x: 0, y: 0, vx: 10, vy: 0 };
        const b = { x: 5, y: 0, vx: -10, vy: 0 };

        resolveCollision(a, b, { x: 1, y: 0 }, 2);

        expect(a.vx).toBe(-10);
        expect(b.vx).toBe(10);
    });

    test("does nothing if objects separating", () => {
        const a = { x: 0, y: 0, vx: -5, vy: 0 };
        const b = { x: 5, y: 0, vx: 5, vy: 0 };

        resolveCollision(a, b, { x: 1, y: 0 }, 1);

        expect(a.vx).toBe(-5);
        expect(b.vx).toBe(5);
    });
});

describe("Wall Handling", () => {

    test("reverses velocity when hitting left wall", () => {
        const shape = {
            x: -1,
            y: 10,
            vx: -20,
            vy: 0,
            aabb: { minX: -5, minY: 5, maxX: 5, maxY: 15 }
        };

        global.width = 100;
        global.height = 100;

        handleWalls(shape);

        expect(shape.vx).toBe(20);
    });

    test("reverses velocity when hitting bottom wall", () => {
        const shape = {
            x: 50,
            y: 101,
            vx: 0,
            vy: 30,
            aabb: { minX: 40, minY: 95, maxX: 60, maxY: 110 }
        };

        gameState.world = { width: 200, height: 100 };

        handleWalls(shape);

        expect(shape.vy).toBe(-30);
    });
});

describe("Vertex and AABB computation", () => {

    test("circle AABB correct", () => {
        const shape = {
            type: "circle",
            x: 50,
            y: 50,
            size: 10
        };

        computeVerticesAndAABB(shape);

        expect(shape.aabb.minX).toBe(40);
        expect(shape.aabb.maxX).toBe(60);
    });

    test("triangle produces 3 vertices", () => {
        const shape = {
            type: "triangle",
            x: 0,
            y: 0,
            size: 10,
            angle: 0
        };

        computeVerticesAndAABB(shape);

        expect(shape.vertices.length).toBe(3);
    });

    test("square produces 4 vertices", () => {
        const shape = {
            type: "square",
            x: 0,
            y: 0,
            size: 10,
            angle: 0
        };

        computeVerticesAndAABB(shape);

        expect(shape.vertices.length).toBe(4);
    });
});

describe("initShapes", () => {

    beforeEach(() => {
        gameState.CONFIG = {
            NUM_SHAPES: 5,
            SHAPE_SIZE: 5,
            MIN_SPEED: 10,
            MAX_SPEED: 20,
            MIN_OMEGA: -1,
            MAX_OMEGA: 1,
            COLORS: ["#fff"]
        };
    });

    test("creates correct number of shapes", () => {
        const shapes = initShapes(5);
        expect(shapes.length).toBe(5);
    });

    test("all shapes have AABB", () => {
        const shapes = initShapes(3);
        for (let s of shapes) {
            expect(s.aabb).toBeDefined();
        }
    });
});
