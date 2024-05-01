class Asteroid{

  constructor(asteroid) {
    this.body=Bodies.circle(asteroid.pos.x,asteroid.pos.y,asteroid.r,{ frictionAir: 0, friction: 0, restitution: 1,label:'ASTEROID'});
    Composite.add(engine.world, [this.body]);
    Body.setMass(this.body,Math.PI*asteroid.r*asteroid.r);
    this.id=asteroid.id;
    this.image=asteroid.image;
    this.points=asteroid.points.copyWithin();
    this.pos=this.body.position;
    this.r=asteroid.r;
    this.type=this.body.label;
    Body.setVelocity(this.body,{x:asteroid.vel.x,y:asteroid.vel.y});
    this.vel=this.body.velocity;
    Body.setAngle(this.body,asteroid.heading);
    Body.setAngularVelocity(this.body,asteroid.rotation);
  }

  static removeAll(asteroids){
    let remove=[];
    for (let asteroid of asteroids) {
      remove.push(asteroid.body);
    }
    Composite.remove(engine.world,remove);
  }

  static show(asteroid){
    push();
    translate(asteroid.pos.x, asteroid.pos.y,0);
    rotate(asteroid.body.angle);

    if (canvas.hasOwnProperty('GL')) {
      textureMode(NORMAL);
      texture(asteroidImages[asteroid.image]);
       beginShape();
      for (var point of asteroid.points){
        let x=map(point.x,-asteroid.r*2,asteroid.r*2,0,1);
        let y=map(point.y,-asteroid.r*2,asteroid.r*2,0,1);
        vertex(point.x,point.y,x,y);
      }
      endShape(CLOSE);
      } else {
      fill(map(asteroid.image,0,2,51,200));
      stroke(255);
      strokeWeight(4);
      beginShape();
      for (var point of asteroid.points){
        vertex(point.x,point.y);
      }
      endShape(CLOSE);
    }
    pop();
  }

  static isHit(asteroid,object){
    var d=dist(asteroid.pos.x,asteroid.pos.y,object.pos.x,object.pos.y);
    return (d<asteroid.r+object.r);
  }

  static edges(asteroid) {
    if (asteroid.pos.x>gameParams.arena.width-asteroid.r) {
      asteroid.pos.x=gameParams.arena.width-asteroid.r;
      asteroid.vel.x=-asteroid.vel.x;
    } else if (asteroid.pos.x<asteroid.r) {
      asteroid.pos.x=asteroid.r;
      asteroid.vel.x=-asteroid.vel.x;
    }
    if (asteroid.pos.y>gameParams.arena.height-asteroid.r) {
      asteroid.pos.y=gameParams.arena.height-asteroid.r;
      asteroid.vel.y=-asteroid.vel.y;
    } else if (asteroid.pos.y<asteroid.r) {
      asteroid.pos.y=asteroid.r;
      asteroid.vel.y=-asteroid.vel.y;
    }
  }

  static collides(asteroid,otherAsteroid) {
    var d=dist(asteroid.pos.x,asteroid.pos.y,otherAsteroid.pos.x,otherAsteroid.pos.y);
    return (d<asteroid.r+otherAsteroid.r);
  }

  static getAsteroidById(id,asteroids){
    for (let asteroid of asteroids){
      if (asteroid.id==id){
        return asteroid;
      }
    }
    return null;
  }
}





