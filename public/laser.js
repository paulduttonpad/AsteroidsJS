class Laser{
  static show(laser) {
    if (!this.edges(laser)){
      push();
      translate(laser.pos.x, laser.pos.y);
      rotate(laser.heading || 0);
      noStroke();
      fill(lerpColor(color(laser.colour.R,laser.colour.G,laser.colour.B),color(gameParams.arena.colour),1-laser.life));
      ellipse(0,0,laser.r*4,laser.r*2);
      pop();
    }
  }

  static update(laser){
    laser.pos=addVectorsPing(laser.pos,laser.vel);
    laser.acc= {x:0,y:0};
    laser.life-=0.01*ping;
    laser.r*=0.99;
  }

  static edges(laser) {
    return (laser.pos.x>gameParams.arena.width) ||
           (laser.pos.x<0) ||
           (laser.pos.y>gameParams.arena.height) ||
           (laser.pos.y<0);
  }
}