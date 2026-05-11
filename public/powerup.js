class Powerup{
  constructor(powerup) {
    this.type="POWERUP";
    this.id=powerup.id;
    this.pos={x:powerup.pos.x,y:powerup.pos.y};
    this.vel={x:powerup.vel.x,y:powerup.vel.y};
    this.r=powerup.r || 14;
    this.level=powerup.level || 1;
    this.life=powerup.life || 1;
    this.colour=powerup.colour || {R:255,G:220,B:60};
  }

  static applyNetworkUpdate(powerup, data){
    if (data.pos) powerup.pos={x:data.pos.x,y:data.pos.y};
    if (data.vel) powerup.vel={x:data.vel.x,y:data.vel.y};
    if (data.r !== undefined) powerup.r=data.r;
    if (data.level !== undefined) powerup.level=data.level;
    if (data.life !== undefined) powerup.life=data.life;
    if (data.colour) powerup.colour=data.colour;
  }

  static update(powerup){
    powerup.pos=addVectorsPing(powerup.pos,powerup.vel);
  }

  static show(powerup){
    push();
    translate(powerup.pos.x,powerup.pos.y,2);
    rotate(frameCount*0.05);
    const c = powerup.colour || {R:255,G:220,B:60};
    stroke(c.R,c.G,c.B);
    strokeWeight(3);
    fill(c.R,c.G,c.B,120);
    beginShape();
    vertex(0,-powerup.r);
    vertex(powerup.r,0);
    vertex(0,powerup.r);
    vertex(-powerup.r,0);
    endShape(CLOSE);
    noFill();
    circle(0,0,powerup.r*2.4);
    pop();
  }
}
