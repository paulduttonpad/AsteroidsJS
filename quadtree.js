
class Rectangle {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  contains(point) {
    return (point.x >= this.x - this.w &&
      point.x < this.x + this.w &&
      point.y >= this.y - this.h &&
      point.y < this.y + this.h);
  }

  intersects(range) {
    return !(range.x - range.w > this.x + this.w ||
      range.x + range.w < this.x - this.w ||
      range.y - range.h > this.y + this.h ||
      range.y + range.h < this.y - this.h);
  }

}

class Quadtree extends Rectangle {
  constructor(b, n) {
    super(b.x, b.y, b.w, b.h);
    this.capacity = n;
    this.points = []
    this.divided = false;
    this.subdivisions = new Array(4);
  }

  rebuild() {
    this.subdivisions = [];
    this.points = [];
    this.divided = false;
  }

  subdivide() {
    let x = this.x;
    let y = this.y;
    let w = this.w;
    let h = this.h;
    let ne = new Rectangle(x + w / 2, y - h / 2, w / 2, h / 2);
    this.subdivisions[0] = new Quadtree(ne, this.capacity);
    let nw = new Rectangle(x - w / 2, y - h / 2, w / 2, h / 2);
    this.subdivisions[1] = new Quadtree(nw, this.capacity);
    let se = new Rectangle(x + w / 2, y + h / 2, w / 2, h / 2);
    this.subdivisions[2] = new Quadtree(se, this.capacity);
    let sw = new Rectangle(x - w / 2, y + h / 2, w / 2, h / 2);
    this.subdivisions[3] = new Quadtree(sw, this.capacity);
    this.divided = true;
  }

  query(range, found = []) {
    if (!this.intersects(range)) {
      return found;
    } else {
      for (let p of this.points) {
        if (range.contains(p)) {
          found.push(p);
        }
      }
      if (this.divided) {
        for (let division of this.subdivisions) {
          division.query(range, found);
        }
      }
    }
    return found;
  }

  insert(point) {

    if (!this.contains(point)) {
      return false;
    }

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    } else {
      if (!this.divided) {
        this.subdivide();
      }
      for (let division of this.subdivisions) {
        division.insert(point);
      }

    }
  }


}

module.exports = {Quadtree,Rectangle}