class Powerup{
  constructor(x,y) {
    this.type="POWERUP";
    this.id='powerup-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
    this.pos = {x:x,y:y};
    this.vel = {x:random(-2,2),y:random(-2,2)};
    this.acc = {x:0,y:0};
    this.r=14;
    this.level=1;
    this.life=60*30;
    this.attractionRadius=200;
    this.colour={R:255,G:220,B:60};
  }

  update(ping, ships, gameParams) {
    const target = this.getAttractionTarget(ships);
    if (target) {
      const dx = target.pos.x-this.pos.x;
      const dy = target.pos.y-this.pos.y;
      const d = Math.sqrt(dx*dx+dy*dy) || 1;
      this.acc.x += (dx/d)*0.8;
      this.acc.y += (dy/d)*0.8;
    }

    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    this.vel.x *= 0.96;
    this.vel.y *= 0.96;

    const speed = Math.sqrt(this.vel.x*this.vel.x+this.vel.y*this.vel.y);
    const maxSpeed = target ? 12 : 4;
    if (speed > maxSpeed) {
      this.vel.x = (this.vel.x/speed)*maxSpeed;
      this.vel.y = (this.vel.y/speed)*maxSpeed;
    }

    this.pos.x += this.vel.x*ping;
    this.pos.y += this.vel.y*ping;
    this.acc = {x:0,y:0};
    this.life -= ping;
    this.edges(gameParams);
  }

  getAttractionTarget(ships){
    let nearest = null;
    let nearestD2 = this.attractionRadius*this.attractionRadius;
    for (const ship of ships){
      if (!ship || ship.explode) continue;
      const dx = ship.pos.x-this.pos.x;
      const dy = ship.pos.y-this.pos.y;
      const d2 = dx*dx+dy*dy;
      if (d2 < nearestD2){
        nearest = ship;
        nearestD2 = d2;
      }
    }
    return nearest;
  }

  collides(other){
    const dx = this.pos.x-other.pos.x;
    const dy = this.pos.y-other.pos.y;
    return (dx*dx+dy*dy < (this.r+other.r)*(this.r+other.r));
  }

  edges(gameParams) {
    if (this.pos.x>gameParams.arena.width-this.r) {
      this.pos.x=gameParams.arena.width-this.r;
      this.vel.x=-Math.abs(this.vel.x);
    } else if (this.pos.x<this.r) {
      this.pos.x=this.r;
      this.vel.x=Math.abs(this.vel.x);
    }
    if (this.pos.y>gameParams.arena.height-this.r) {
      this.pos.y=gameParams.arena.height-this.r;
      this.vel.y=-Math.abs(this.vel.y);
    } else if (this.pos.y<this.r) {
      this.pos.y=this.r;
      this.vel.y=Math.abs(this.vel.y);
    }
  }

  getData(){
    return {
      type:this.type,
      id:this.id,
      pos:{x:this.pos.x,y:this.pos.y},
      vel:{x:this.vel.x,y:this.vel.y},
      r:this.r,
      level:this.level,
      life:this.life,
      colour:this.colour
    }
  }
}

function random(a,b){
  if (b==undefined){
    return Math.random()*a;
  } else if (a==undefined){
    return Math.random();
  } else {return Math.random()*(b-a)+a}
}

module.exports = Powerup;
