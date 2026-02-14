import Rectangle from './rectangle'

describe('Rectangle getters', () => {
    it('should calculate borders correctly', () => {
        const rect = new Rectangle(0, 0, 3, 2)
        expect(rect.left).toBe(0)
        expect(rect.right).toBe(3)
        expect(rect.top).toBe(0)
        expect(rect.bottom).toBe(2)

        //    0    1    2    3
        // 0  ┼──────────────○──
        //    │              │
        // 1  │              │
        //    │              │
        // 2  ┼──────────────○ (3, 2)
        //    │
        //    │
    })
})

describe('Rectangle.contains()', () => {
    let rect
    beforeEach(() => {
        rect = new Rectangle(0, 0, 3, 2)
    })

    it('should returns true if point is inside the rect', () => {
        expect(rect.contains({x: 1, y: 1})).toBeTruthy()

        //    0    1    2    3
        // 0  ┼──────────────○──
        //    │              │
        // 1  │   ○ (1, 1)   │
        //    │              │
        // 2  ┼──────────────○ (3, 2)
        //    │
        //    │
    })

    it('should returns true if point located on rects left or top border', () => {
        expect(rect.contains({x: 2, y: 0})).toBeTruthy()
        expect(rect.contains({x: 0, y: 1})).toBeTruthy()

        //    0    1    2    3
        // 0  ┼─────────○────○──
        //    │      (2, 0)  │
        // 1  ○ (0, 1)       │
        //    │              │
        // 2  ┼──────────────○ (3, 2)
        //    │
        //    │
    })

    it('should returns false if point located on rects right or bottom border', () => {
        expect(rect.contains({x: 3, y: 1})).toBeFalsy()
        expect(rect.contains({x: 2, y: 2})).toBeFalsy()

        //    0    1    2    3
        // 0  ┼──────────────○──
        //    │              │
        // 1  │              ○ (3, 1)
        //    │              │
        // 2  ┼─────────○────○ (3, 2)
        //    │      (2, 2)
        //    │
    })

    it('should returns false if point is out of rect', () => {
        expect(rect.contains({x: 4, y: 1})).toBeFalsy()

        //    0    1    2    3
        // 0  ┼──────────────○──
        //    │              │
        // 1  │              │    ○ (4, 1)
        //    │              │
        // 2  ┼──────────────○ (3, 2)
        //    │
        //    │
    })
})

describe('Rectangle.intersects()', () => {
    let rect
    beforeEach(() => {
        rect = new Rectangle(0, 0, 3, 2)
    })

    it('should returns true if rects are intersected', () => {
        const otherRect = new Rectangle(1, 1, 3, 2)
        expect(rect.intersects(otherRect)).toBeTruthy()

        //    0    1    2    3    4
        // 0  ┼──────────────○──────
        //    │              │
        // 1  │   ○───────────────○
        //    │   │◽◽◽◽◽◽◽│
        // 2  ┼──────────────○    │
        //    │   │               │
        // 3  │   ○───────────────○
    })

    it('should returns true if one rect contains other', () => {
        const otherRect = new Rectangle(1, 0, 1, 2)
        expect(rect.intersects(otherRect)).toBeTruthy()

        //    0    1    2    3    4
        // 0  ┼────○────○────○──────
        //    │    │◽◽◽◽│    │
        // 1  │    │◽◽◽◽│    │
        //    │    │◽◽◽◽│    │
        // 2  ┼────○────○────○
        //    │
    })

    it('should returns false if rects are not intersected', () => {
        const otherRect = new Rectangle(10, 10, 1, 1)
        expect(rect.intersects(otherRect)).toBeFalsy()
    })
})