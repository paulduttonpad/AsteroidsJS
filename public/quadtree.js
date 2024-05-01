
class Point {
  constructor(x, y, userData) {
    this.x=x;
    this.y=y;
    this.userData = userData;
  }
}

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

  show() {
    stroke(100);
    noFill();
    strokeWeight(1);
    rectMode(CENTER);
    rect(this.x, this.y, this.w * 2, this.h * 2);
  }
}

class Circle {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.rSquared = this.r * this.r;
  }

  contains(point) {
    // check if the point is in the circle by checking if the euclidean distance of
    // the point and the center of the circle if smaller or equal to the radius of
    // the circle
    let d = Math.pow((point.x - this.x), 2) + Math.pow((point.y - this.y), 2);
    return d <= this.rSquared;
  }

  intersects(range) {

    var xDist = Math.abs(range.x - this.x);
    var yDist = Math.abs(range.y - this.y);

    // radius of the circle
    var r = this.r;

    var w = range.w;
    var h = range.h;

    var edges = Math.pow((xDist - w), 2) + Math.pow((yDist - h), 2);

    // no intersection
    if (xDist > (r + w) || yDist > (r + h))
      return false;

    // intersection within the circle
    if (xDist <= w || yDist <= h)
      return true;

    // intersection on the edge of the circle
    return edges <= this.rSquared;
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


  show() {
    super.show();
    // for (let p of this.points) {
    //   strokeWeight(2);
    //   point(p.x, p.y);
    // }

    if (this.divided) {
      for (let division of this.subdivisions) {
        division.show();
      }
    }
  }

}