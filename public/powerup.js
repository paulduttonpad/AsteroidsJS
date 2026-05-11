class Powerup{
  constructor(powerup) {
    this.type=powerup.type || "POWERUP";
    this.id=powerup.id;
    this.pos={x:powerup.pos.x,y:powerup.pos.y};
    this.vel={x:powerup.vel.x,y:powerup.vel.y};
    this.r=powerup.r || (powerup.type === 'HEALTH' ? 16 : 14);
    this.level=powerup.level || 1;
    this.health=powerup.health || 50;
    this.life=powerup.life || 1;
    this.colour=powerup.colour || (powerup.type === 'HEALTH' ? {R:255,G:0,B:0} : {R:255,G:220,B:60});
  }

  static applyNetworkUpdate(powerup, data){
    if (data.pos) powerup.pos={x:data.pos.x,y:data.pos.y};
    if (data.vel) powerup.vel={x:data.vel.x,y:data.vel.y};
    if (data.r !== undefined) powerup.r=data.r;
    if (data.type !== undefined) powerup.type=data.type;
    if (data.level !== undefined) powerup.level=data.level;
    if (data.health !== undefined) powerup.health=data.health;
    if (data.life !== undefined) powerup.life=data.life;
    if (data.colour) powerup.colour=data.colour;
  }

  static update(powerup){
    powerup.pos=addVectorsPing(powerup.pos,powerup.vel);
  }

  static show(powerup){
    const remainingLife = typeof powerup.life === 'number' ? powerup.life : 999999;
    if (remainingLife <= 300 && floor(frameCount / 6) % 2 === 0) return;

    push();
    translate(powerup.pos.x,powerup.pos.y,2);
    const c = powerup.colour || (powerup.type === 'HEALTH' ? {R:255,G:0,B:0} : {R:255,G:220,B:60});
    const flashAlpha = remainingLife <= 300 ? 220 : 120;
    stroke(c.R,c.G,c.B);
    if (powerup.type === 'HEALTH') {
      strokeWeight(4);
      fill(40,0,0,flashAlpha);
      circle(0,0,powerup.r*2);
      strokeWeight(7);
      line(-powerup.r*0.55,0,powerup.r*0.55,0);
      line(0,-powerup.r*0.55,0,powerup.r*0.55);
    } else {
      rotate(frameCount*0.05);
      strokeWeight(3);
      fill(c.R,c.G,c.B,flashAlpha);
      beginShape();
      vertex(0,-powerup.r);
      vertex(powerup.r,0);
      vertex(0,powerup.r);
      vertex(-powerup.r,0);
      endShape(CLOSE);
      noFill();
      circle(0,0,powerup.r*2.4);
    }
    pop();
  }
}
