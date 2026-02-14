import Rectangle from './rectangle'

export default class QuadTree {
    constructor(boundary, capacity = 4) {
        if (!boundary) {
            throw TypeError('boundary is null or undefined')
        }

        if (!(boundary instanceof Rectangle)) {
            throw TypeError('boundary should be a Rectangle')
        }

        this._points = []
        this._boundary = boundary
        this._capacity = capacity
        this._hasChildren = false
        this._children = []
    }

    // todo
    insert(point) {
        return true
    }

    get length() {
        let count = this._points.length
        if (this._hasChildren) {
            // handle childrens somehow
        }
        return count
    }

    queryRange(rect, found = []) {
        return found
    }

    // todo call if the number of elements is too big
    _subdivide() {
    }

    clear() {
        // clear _points and _children arrays
        // see https://stackoverflow.com/questions/1232040/how-do-i-empty-an-array-in-javascript
        this._points = []
        this._children = []
        this._hasChildren = false
    }
}
