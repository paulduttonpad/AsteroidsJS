
class Ship{
  constructor(x, y, heading, id) {
    this.type="SHIP";
    this.id=id;
    this.pos = {x,y};
    this.vel = {x:0,y:0};
    this.acc = {x:0,y:0};
    this.heading = heading || 0;
    this.thrustOn = false;
    this.size = 20;
    this.r=this.size;
    this.turning = 0;
    this.score=0;
    this.life=100;
    this.explode=false;
    this.colour={R:255,G:255,B:255};
    this.shield=100;
    this.powerupLevel=0;
  }

  collides(other){
    var d2=dist2(this.pos.x,this.pos.y,other.pos.x,other.pos.y);
    return (d2<(this.r+other.r)**2);
  }

  getData(){
    return {
      pos:{x:this.pos.x,y:this.pos.y},
      vel:{x:this.vel.x,y:this.vel.y},
      thrustOn:this.thrustOn,
      heading:this.heading,
      turning:this.turning,
      score:this.score,
      life:this.life,
      shield:this.shield,
      powerupLevel:this.powerupLevel,
      explode:this.explode,
      explodePct:this.explodePct,
      r:this.r,
      id:this.id,
      colour:this.colour
    }
  }
  getLifeData(){
    return {
      life:this.life,
      explode:this.explode,
      explodePct:this.explodePct,
      shield:this.shield,
      powerupLevel:this.powerupLevel,
      id:this.id
    }
  }

  static sendLifeData(ships){
    const data={
      ships:[]
    };
    for (let ship of ships){
      data.ships.push(ship.getLifeData());
    }
    return {label:'lifedata',data:data};
  }
}

function dist2(x1,y1,x2,y2){
  let a2=(x1-x2) ** 2;
  let b2=(y1-y2) ** 2;
  return (a2+b2);
}

module.exports=Ship;