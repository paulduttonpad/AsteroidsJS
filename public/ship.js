class Ship {
  constructor(x, y, heading, id) {
  this.id=id;
  this.pos = createVector(x, y);
  this.vel = createVector();
  this.acc = createVector();
  this.last={x,y,heading:0};
  this.moved=true;
  this.heading = heading || 0;
  this.thrustOn = false;
  this.size = 20;
  this.r=this.size;
  this.turning = 0;
  this.score=0;
  this.life=100;
  this.type="SHIP";
  this.colour={R:random(100,255),G:random(100,255),B:random(100,255)};
  this.explode=false;
  this.explodePct=0;
  this.shield=0;
  
  this.lasers = [];
}

  getData() {
    return {
      pos:{x:floor(this.pos.x),y:floor(this.pos.y)},
      vel:{x:floor(this.vel.x),y:floor(this.vel.y)},
      thrustOn:this.thrustOn,
      heading:floor(this.heading*10)/10,
      score:this.score,
      id:this.id,
      r:this.r,
      size:this.size,
      life:this.life,
      shield:this.shield,
      explode:this.explode,
      explodePct:this.explodePct,
      colour:this.colour
    }
  }

  show() {
    push();
    translate(this.pos.x,this.pos.y,3);
    rotate(this.heading);
    if (!this.explode){
      if (this.thrustOn){
        push();
        translate(0,0,-1);
        stroke(255,0,0,150);
        fill(255,237,0,150);
        strokeWeight(2);
        triangle(-this.size+10,0,-this.size*2+(random(-5,5)),-this.size/2,-this.size*2+(random(-5,5)),this.size/2);
        pop();
      }
      fill(51);
      strokeWeight(4);
      stroke(this.colour.R,this.colour.G,this.colour.B);
      triangle(-this.size, -this.size, -this.size, this.size, this.size * 2, 0);
      if (this.shield>0){
        noFill();
        strokeWeight(4);
        stroke(map(sin(this.shield/4),-1,1,100,140), map(sin(this.shield/4),-1,1,150,220), map(sin(this.shield/4),-1,1,155,255));
        circle(5,0,this.size*5);
      }
    } else {
      let x,y;
      let a={x1:-this.size  ,y1:-this.size,x2:-this.size  ,y2: this.size};
      let b={x1:-this.size  ,y1: this.size,x2: this.size*2,y2: 0        };
      let c={x1: this.size*2,y1: 0        ,x2:-this.size  ,y2:-this.size};
      strokeWeight(4);
      stroke(this.colour.R,this.colour.G,this.colour.B);

      push();
      x=lerp((a.x1+a.x2)/2,-width,this.explodePct);
      y=(a.y1+a.y2)/2;
      translate(x,y);
      rotate(map(this.explodePct,0,1,-TWO_PI,TWO_PI));
      rotate(HALF_PI);
      line(-this.size,0,this.size,0);
      pop();

      push();
      x=lerp((b.x1+b.x2)/2,width*0.3,this.explodePct);
      y=lerp((b.y1+b.y2)/2,height,this.explodePct);
      translate(x,y);
      rotate(map(this.explodePct,0,1,-TWO_PI,TWO_PI)); 
      rotate(-PI/6+0.2);         
      line(-this.size*1.5,0,this.size*1.5,0);
      pop(); 

      push();
      x=lerp((c.x1+c.x2)/2,width*0.3,this.explodePct);
      y=lerp((c.y1+c.y2)/2,-height,this.explodePct);
      translate(x,y);
      rotate(map(this.explodePct,0,1,-TWO_PI,TWO_PI)); 
      rotate(PI/6-0.2);     
      line(-this.size*1.5,0,this.size*1.5,0);
      pop();

    }

    pop();

  };

  update() {
    this.last.x=this.pos.x;
    this.last.y=this.pos.y;
    this.last.heading=this.heading;
    if (!this.explode){
      if (!this.turning==0){
        this.heading += this.turning*ping;
        this.turning*=1.01;
        if (this.turning>100) {
          this.turning=100;
        }
        this.heading=this.heading %360;
      }
      this.vel.add(this.acc);
      this.vel.mult(0.96);
      this.pos.add(this.vel.copy().mult(ping));
      this.acc.mult(0);
      

      if (this.thrustOn){
        let thrust = p5.Vector.fromAngle(this.heading);
        thrust.setMag(1);
        this.applyForce(thrust);
      }
      this.edges();
    } else {
      if (this.explodePct==0){
        explosions.push(new Explosion(this.pos.x,this.pos.y,color(this.colour.R,this.colour.G,this.colour.B)));
      }
      this.explodePct+=0.01;
    }
    for (var laser of this.lasers) {
      laser.update();
    }
    this.moved=
      floor(this.last.x)!=floor(this.pos.x) || 
      floor(this.last.y)!=floor(this.pos.y) || 
      floor(this.last.heading*10)!=floor(this.heading*10) ||
      (this.explode && this.explodePct<3);
    // console.log(this.moved);
  };

  applyForce(force) {
    this.acc.add(force);
  };
  
  edges() {
    if (this.pos.x>gameParams.arena.width-this.size) {
      this.pos.x=gameParams.arena.width-this.size;
      this.vel.x=0;
    } else if (this.pos.x<0+this.size) {
      this.pos.x=0+this.size;
      this.vel.x=0;
    }
    if (this.pos.y>gameParams.arena.height-this.size) {
      this.pos.y=gameParams.arena.height-this.size;
      this.vel.y=0;
    } else if (this.pos.y<0+this.size) {
      this.pos.y=0+this.size;
      this.vel.y=0;
    }
    
    for (let i=this.lasers.length-1;i>=0;i--){
      var laser=this.lasers[i];
      if (laser.pos.x<0-this.size || laser.pos.x>gameParams.arena.width+this.size || laser.pos.y<0-this.size || laser.pos.y>gameParams.arena.height+this.size || laser.life<=0){
        this.lasers.splice(i,1);
      }
    }
  }

  isHit(object){
    var d=dist(this.pos.x,this.pos.y,object.pos.x,object.pos.y);
    return (d<this.r+object.r+20);
  }

  fire(r){
    if (!this.explode){
      var data={r:r,id:this.id,heading:this.heading,pos:{x:this.pos.x,y:this.pos.y},vel:{x:this.vel.x,y:this.vel.y}};
      socket.emit('fire',data);
    }
  }

  collides(other) {
    var d=dist(this.pos.x,this.pos.y,other.pos.x,other.pos.y);
    return (d<this.r+other.r);
  }

  shieldOn(shield){
    let newShield;
    if (this.shield>0) {
      newShield=0;
    } else {
      newShield=shield;
    }
    socket.compress(true).emit('shieldOn',{id:this.id,shield:newShield});
  }

  static isHit (s,object){
    var d=dist(s.pos.x,s.pos.y,object.pos.x,object.pos.y);
    return (d<s.r+object.r+20);
  }
}




const REMOTE_SHIP_INTERPOLATION_MS = 100;

function currentClientMillis(){
  if (typeof millis === 'function') {
    return millis();
  }
  return Date.now();
}

function clonePoint(point, fallback={x:0,y:0}){
  return {
    x: safeNumber(point && point.x, fallback.x),
    y: safeNumber(point && point.y, fallback.y)
  };
}

function normaliseAngle(angle){
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function lerpAngle(from, to, amount){
  return from + normaliseAngle(to - from) * amount;
}

function initialiseRemoteShipSmoothing(s){
  if (!s) return;
  const pos = clonePoint(s.pos);
  const heading = safeNumber(s.heading);
  s._renderPos = clonePoint(pos);
  s._renderHeading = heading;
  s._interpFromPos = clonePoint(pos);
  s._interpToPos = clonePoint(pos);
  s._interpFromHeading = heading;
  s._interpToHeading = heading;
  s._interpStart = currentClientMillis();
  s._interpEnd = s._interpStart;
}

function getSmoothedShipDrawState(s){
  if (!s || !s.pos) return null;
  if (!s._renderPos) {
    initialiseRemoteShipSmoothing(s);
  }

  const now = currentClientMillis();
  const duration = Math.max(1, safeNumber(s._interpEnd) - safeNumber(s._interpStart));
  const amount = constrain((now - safeNumber(s._interpStart)) / duration, 0, 1);

  s._renderPos = {
    x: lerp(s._interpFromPos.x, s._interpToPos.x, amount),
    y: lerp(s._interpFromPos.y, s._interpToPos.y, amount)
  };
  s._renderHeading = lerpAngle(s._interpFromHeading, s._interpToHeading, amount);

  return {
    pos: s._renderPos,
    heading: s._renderHeading
  };
}

function prepareShipInterpolation(s, data){
  if (!s || !data) return;
  const hasPosition = data.pos && typeof data.pos.x === 'number' && typeof data.pos.y === 'number';
  const hasHeading = typeof data.heading === 'number';
  if (!hasPosition && !hasHeading) return;

  const current = getSmoothedShipDrawState(s);
  const now = currentClientMillis();

  if (hasPosition) {
    s._interpFromPos = clonePoint(current && current.pos ? current.pos : s.pos);
    s._interpToPos = clonePoint(data.pos, s._interpFromPos);
  }
  if (hasHeading) {
    s._interpFromHeading = safeNumber(current && current.heading, safeNumber(s.heading));
    s._interpToHeading = data.heading;
  }

  s._interpStart = now;
  s._interpEnd = now + REMOTE_SHIP_INTERPOLATION_MS;
}

function drawOtherShips(){
  var size=20;
  for (let i=0;i<ships.length;i++){
    let s=ships[i];
    if (!s || !s.pos) continue;
    const shipColour = typeof safeColour === 'function' ? safeColour(s.colour, s.id) : (s.colour || {R:255,G:255,B:255});
    s.colour = shipColour;
    const smooth = getSmoothedShipDrawState(s);
    if (!smooth || !smooth.pos) continue;
    if (smooth.pos.x>ship.pos.x-width/2-size*2 &&
        smooth.pos.x<ship.pos.x+width/2+size*2 &&
        smooth.pos.y>ship.pos.y-height/2-size*2 &&
        smooth.pos.y<ship.pos.y+height/2+size*2){
      push();
      translate(smooth.pos.x,smooth.pos.y);
      rotate(smooth.heading);
      if (!s.explode){
        if (s.thrustOn){
          stroke(255,0,0,150);
          fill(255,237,0,150);
          strokeWeight(2);
          triangle(-size+10,0,-size*2+(random(-5,5)),-size/2,-size*2+(random(-5,5)),size/2);
        }
        fill(51);
        strokeWeight(4);
        stroke(shipColour.R,shipColour.G,shipColour.B);
        triangle(-size, -size, -size, size, size * 2, 0);
        if (s.shield>0){
            noFill();
            strokeWeight(4);
            stroke(map(sin(s.shield/4),-1,1,100,140), map(sin(s.shield/4),-1,1,150,220), map(sin(s.shield/4),-1,1,155,255));
            circle(5,0,size*5);
        }
      } else {  
        let x,y;
        let a={x1:-size  ,y1:-size,x2:-size  ,y2: size};
        let b={x1:-size  ,y1: size,x2: size*2,y2: 0   };
        let c={x1: size*2,y1: 0   ,x2:-size  ,y2:-size};
        strokeWeight(4);
        stroke(shipColour.R,shipColour.G,shipColour.B);

        push();
        x=lerp((a.x1+a.x2)/2,-width,s.explodePct);
        y=(a.y1+a.y2)/2;
        translate(x,y);
        rotate(map(s.explodePct,0,1,-TWO_PI,TWO_PI));
        rotate(HALF_PI);
        line(-size,0,size,0);
        pop();

        push();
        x=lerp((b.x1+b.x2)/2,width*0.3,s.explodePct);
        y=lerp((b.y1+b.y2)/2,height,s.explodePct);
        translate(x,y);
        rotate(map(s.explodePct,0,1,-TWO_PI,TWO_PI)); 
        rotate(-PI/6+0.2);         
        line(-size*1.5,0,size*1.5,0);
        pop(); 

        push();
        x=lerp((c.x1+c.x2)/2,width*0.3,s.explodePct);
        y=lerp((c.y1+c.y2)/2,-height,s.explodePct);
        translate(x,y);
        rotate(map(s.explodePct,0,1,-TWO_PI,TWO_PI)); 
        rotate(PI/6-0.2);     
        line(-size*1.5,0,size*1.5,0);
        pop();
        if (s.explodePct==0){
          explosions.push(new Explosion(s.pos.x,s.pos.y,color(s.colour.R,s.colour.G,s.colour.B)));
        }
        s.explodePct+=0.01;
      }
      pop();
    }
  }
}



