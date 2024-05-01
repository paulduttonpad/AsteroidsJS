const Matter = require('matter-js');

// module aliases
var Engine = Matter.Engine,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;

class Asteroid {
  
  constructor(engine,x,y,r,i,v) {
    this.body=Bodies.circle(x,y,r,{ frictionAir: 0, friction: 0, restitution: 1,label:'ASTEROID'});
    Composite.add(engine.world, [this.body]);
    Body.setMass(this.body,Math.PI*r*r);
    this.type=this.body.label;
    this.id=this.body.id;
    if (i == undefined){
      this.image=Math.floor(random(3));
    } else {
      this.image=i;
    }
    this.pos=this.body.position;
    Body.setVelocity(this.body,{x:random(-5,5),y:random(-5,5)});
    this.vel=this.body.velocity;
    if (v) {
      Body.setVelocity(this.body,{x:this.vel.x+(v.x*.5),y:this.vel.y+(v.y*.5)});
    }
    this.r=r;
    Body.setAngle(this.body,random(360));
    Body.setAngularVelocity(this.body,random(-0.05,0.05));
    this.hit=false;
    this.points = [];
    for (var i=0;i<10;i++){
      var point ={};
      var a=map(i,0,10,-Math.PI,Math.PI);
      point.x = (this.r+random(-this.r/4,this.r/4)) * Math.cos(a);
      point.y = (this.r+random(-this.r/4,this.r/4)) * Math.sin(a);
      this.points.push(point);
    }
  }

  collides(other){
    var d2=dist2(this.pos.x,this.pos.y,other.pos.x,other.pos.y);
    return (d2<(this.r+other.r)**2);
  }

  getData(){
    return {
      type:this.type,
      id:this.id,
      image:this.image,
      pos:this.pos,
      vel:this.vel,
      r:this.r,
      points:this.points,
      heading:this.body.angle,
      rotation:this.body.angularVelocity
    }
  }

  getMoveData(){
    return {
      id:this.id,
      pos:this.pos,
      vel:this.vel,
      heading:this.body.angle,
      rotation:this.body.angularVelocity
    }
  }

  static split(engine,gameParams,asteroids,asteroid,vel){

    let number=random(1);
    if (number >0.75 && asteroid.r>gameParams.asteroidSize.min*2) {
      // Split 3 ways;
      let split1=random(0.2,0.4);
      let split2=random(0.6,0.8);
      if (asteroids.length<gameParams.asteroidMax){
        asteroids.push(new Asteroid(engine,asteroid.pos.x-asteroid.r/2,asteroid.pos.y-asteroid.r/2,asteroid.r*split1,asteroid.image,vel));      
        asteroids.push(new Asteroid(engine,asteroid.pos.x-asteroid.r/2,asteroid.pos.y+asteroid.r/2,asteroid.r*(split2-split1),asteroid.image,vel));
        asteroids.push(new Asteroid(engine,asteroid.pos.x+asteroid.r/2,asteroid.pos.y+asteroid.r/2,asteroid.r*(1-split2),asteroid.image,vel));
      }
    } else {
      // Split 2 ways;
      let split=random(0.3,0.7);
      if (asteroids.length<gameParams.asteroidMax){
        asteroids.push(new Asteroid(engine,asteroid.pos.x-asteroid.r/2,asteroid.pos.y-asteroid.r/2,asteroid.r*split,asteroid.image,vel));      
        asteroids.push(new Asteroid(engine,asteroid.pos.x+asteroid.r/2,asteroid.pos.y+asteroid.r/2,asteroid.r*(1-split),asteroid.image,vel));
      }
    }
  }

  static getAsteroidById(id,asteroids){
    for (let asteroid of asteroids){
      if (asteroid.id==id){
        return asteroid;
      }
    }
    return null;
  }
  static removeAsteroid(engine,asteroids,asteroid){
    for (let i=asteroids.length-1;i>=0;i--){
      if (asteroid==asteroids[i]){
        Composite.remove(engine.world, [asteroid.body]);
        asteroids.splice(i,1);
        break;
      }
    }
  }
}

function dist2(x1,y1,x2,y2){
  let a2=(x1-x2) ** 2;
  let b2=(y1-y2) ** 2;
  return (a2+b2);
}

function random(a,b){
  if (b==undefined){
    return Math.random()*a;
  } else if (a==undefined){
    return Math.random();
  } else {return Math.random()*(b-a)+a}

}

function map(n, start1, stop1, start2, stop2, withinBounds) {
  var newval = (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
  if (!withinBounds) {
    return newval;
  }
  if (start2 < stop2) {
    return this.constrain(newval, start2, stop2);
  } else {
    return this.constrain(newval, stop2, start2);
  }
}

module.exports=Asteroid;