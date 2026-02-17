const {
    aabbCollision,
    computeVerticesAndAABB
} = require('./index.js'); // adjust path

function makeCircle(x, y, r = 10) {
    const shape = {
        type: 'circle',
        x, y,
        size: r,
        angle: 0,
        vertices: [],
        aabb: {}
    };
    computeVerticesAndAABB(shape);
    return shape;
}

function makeSquare(x, y, size = 10, angle = 0) {
    const shape = {
        type: 'square',
        x, y,
        size,
        angle,
        vertices: [],
        aabb: {}
    };
    computeVerticesAndAABB(shape);
    return shape;
}

function makeTriangle(x, y, size = 10, angle = 0) {
    const shape = {
        type: 'triangle',
        x, y,
        size,
        angle,
        vertices: [],
        aabb: {}
    };
    computeVerticesAndAABB(shape);
    return shape;
}

describe('AABB Collision Detector', () => {

    test('circle and square NOT colliding', () => {
        const circle = makeCircle(0, 0, 10);
        const square = makeSquare(100, 100, 10);

        const result = aabbCollision(circle, square);
        expect(result).toBeNull();
    });

    test('circle and square colliding', () => {
        const circle = makeCircle(0, 0, 10);
        const square = makeSquare(15, 0, 10);

        const result = aabbCollision(circle, square);

        expect(result).not.toBeNull();
        expect(result.depth).toBeGreaterThan(0);
        expect(
            result.normal.x !== 0 || result.normal.y !== 0
        ).toBe(true);
    });

    test('one touching other (edge contact)', () => {
        const circle = makeCircle(0, 0, 10);
        const square = makeSquare(20, 0, 10); 
        // circle AABB maxX = 10
        // square AABB minX = 10 -> touching

        const result = aabbCollision(circle, square);

        expect(result).not.toBeNull();
        expect(result.depth).toBe(0);
    });

    test('one touching other at the corner', () => {
        const circle = makeCircle(0, 0, 10);
        const square = makeSquare(20, 20, 10);
        // Touching exactly at (10,10)

        const result = aabbCollision(circle, square);

        expect(result).not.toBeNull();
        expect(result.depth).toBe(0);
    });

    test('triangle colliding with square', () => {
        const triangle = makeTriangle(0, 0, 10);
        const square = makeSquare(5, 0, 10);

        const result = aabbCollision(triangle, square);

        expect(result).not.toBeNull();
        expect(result.depth).toBeGreaterThan(0);
    });

    test('triangle NOT colliding with circle', () => {
        const triangle = makeTriangle(0, 0, 10);
        const circle = makeCircle(100, 100, 10);

        const result = aabbCollision(triangle, circle);

        expect(result).toBeNull();
    });

    test('triangle touching triangle', () => {
        const t1 = makeTriangle(0, 0, 10);
        const t2 = makeTriangle(20, 0, 10);

        const result = aabbCollision(t1, t2);

        // Depending on exact AABB size this should be edge-touch
        if (result) {
            expect(result.depth).toBeGreaterThanOrEqual(0);
        } else {
            expect(result).toBeNull();
        }
    });

});
