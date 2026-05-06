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
    this.net = {
      startTime: Asteroid.now(),
      lastUpdateAt: Asteroid.now(),
      duration: 100,
      fromPos: {x:this.pos.x, y:this.pos.y},
      toPos: {x:this.pos.x, y:this.pos.y},
      vel: {x:this.vel.x, y:this.vel.y},
      fromHeading: this.body.angle,
      toHeading: this.body.angle,
      rotation: this.body.angularVelocity || 0
    };
  }

  static applyNetworkUpdate(asteroid, data){
    const now = Asteroid.now();
    const previousUpdateAt = asteroid.net && asteroid.net.lastUpdateAt ? asteroid.net.lastUpdateAt : now;
    const duration = Asteroid.clamp(now - previousUpdateAt, 80, 250);
    const currentPos = {x:asteroid.pos.x, y:asteroid.pos.y};
    const currentHeading = asteroid.body.angle || 0;
    const nextHeading = Asteroid.unwrapAngle(currentHeading, Asteroid.safeNumber(data.heading, currentHeading));

    asteroid.net = {
      startTime: now,
      lastUpdateAt: now,
      duration: duration,
      fromPos: currentPos,
      toPos: {
        x: Asteroid.safeNumber(data.pos && data.pos.x, currentPos.x),
        y: Asteroid.safeNumber(data.pos && data.pos.y, currentPos.y)
      },
      vel: {
        x: Asteroid.safeNumber(data.vel && data.vel.x, asteroid.vel ? asteroid.vel.x : 0),
        y: Asteroid.safeNumber(data.vel && data.vel.y, asteroid.vel ? asteroid.vel.y : 0)
      },
      fromHeading: currentHeading,
      toHeading: nextHeading,
      rotation: Asteroid.safeNumber(data.rotation, asteroid.body.angularVelocity || 0)
    };

    Body.setVelocity(asteroid.body, asteroid.net.vel);
    asteroid.vel = asteroid.body.velocity;
    Body.setAngularVelocity(asteroid.body, asteroid.net.rotation);
  }

  static updateNetworkSmoothing(asteroid){
    if (!asteroid || !asteroid.net) return;

    const now = Asteroid.now();
    const elapsed = Math.max(0, now - asteroid.net.startTime);
    const frameDelta = elapsed / (1000 / 60);
    const targetPos = {
      x: asteroid.net.toPos.x + asteroid.net.vel.x * frameDelta,
      y: asteroid.net.toPos.y + asteroid.net.vel.y * frameDelta
    };
    const targetHeading = asteroid.net.toHeading + asteroid.net.rotation * frameDelta;
    const t = Asteroid.smoothStep(Asteroid.clamp(elapsed / asteroid.net.duration, 0, 1));

    Body.setPosition(asteroid.body, {
      x: Asteroid.lerp(asteroid.net.fromPos.x, targetPos.x, t),
      y: Asteroid.lerp(asteroid.net.fromPos.y, targetPos.y, t)
    });
    Body.setAngle(asteroid.body, Asteroid.lerp(asteroid.net.fromHeading, targetHeading, t));
    Body.setVelocity(asteroid.body, asteroid.net.vel);
    Body.setAngularVelocity(asteroid.body, asteroid.net.rotation);
    asteroid.pos = asteroid.body.position;
    asteroid.vel = asteroid.body.velocity;
  }

  static now(){
    if (typeof millis === 'function') return millis();
    return Date.now();
  }

  static clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  static lerp(a, b, t){
    return a + (b - a) * t;
  }

  static smoothStep(t){
    return t * t * (3 - 2 * t);
  }

  static safeNumber(value, fallback){
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  static unwrapAngle(current, target){
    while (target - current > Math.PI) target -= Math.PI * 2;
    while (target - current < -Math.PI) target += Math.PI * 2;
    return target;
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





