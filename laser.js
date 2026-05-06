
class Laser{
  constructor(x,y,r,heading,id,vx,vy) {
    this.type="LASER";
    this.id=id;
    this.pos = {x:x,y:y};
    this.vel = {x:vx,y:vy};
    this.acc = {x:0,y:0};
    this.heading=heading;
    this.life=1;
    this.r=r;
    this.colour={R:4,G:217,B:255};
  }
  
  update(ping) {
    this.vel=addVectors(this.vel,this.acc);
    this.pos=addVectorsPing(this.pos,this.vel,ping);
    this.acc= {x:0,y:0};
    this.life-=0.01*ping;
    this.r*=0.99;
  }

  edges(gameParams) {
     return (this.pos.x>gameParams.arena.width) ||
     (this.pos.x<0) ||
     (this.pos.y>gameParams.arena.height) ||
     (this.pos.y<0);
   }
   
  applyForce(force) {
    this.acc=addVectors(this.acc,force);
  }

  getData(){
    return {
      type:this.type,
      id:this.id,
      colour:this.colour,
      life:this.life,
      heading:this.heading,
      r:this.r,
      pos:{
        x:this.pos.x,
        y:this.pos.y
      },
      vel:{
        x:this.vel.x,
        y:this.vel.y
      }
    }
  }
  static sendData(lasers){
    const data={
      lasers:[]
    };
    for (let laser of lasers){
      data.lasers.push(laser.getData());
    }
    return {label:'laserdata',data:data};
  }
}

function addVectors(a,b){
  return {
    x:a.x+b.x,
    y:a.y+b.y
  };
}

function addVectorsPing(a,b,ping){
  return {
    x:a.x+b.x*ping,
    y:a.y+b.y*ping
  };
}

module.exports = Laser