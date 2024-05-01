class Explosion{
  constructor(x,y,c){
    this.pos={x:x,y:y}
    this.points=[];
    this.c=color(255);
    if (c) {
      this.c=c;
    }
    for (let i=0;i<10;i++){
      let angle=random(-TWO_PI,TWO_PI);
      let r=random(1,10);
      let l=20;
      let p={life:l,pos:{x:this.pos.x,y:this.pos.y},vel:{x:r*cos(angle),y:r*sin(angle)}}
      ;
      this.points.push(p);
    }
  }
  show(){
    for (let p of this.points){
      stroke(lerpColor(color(this.c),color(gameParams.arena.borderColour),1-(p.life/20)));
      strokeWeight(4);
      point(p.pos.x,p.pos.y);
    }
  }
  update(){
    for (let i=this.points.length-1;i>=0;i--){
      let p=this.points[i];
      p.pos.x+=p.vel.x;
      p.pos.y+=p.vel.y;
      p.life--;
      if (p.life<0 || (p.pos.x>gameParams.arena.width || p.pos.x<0 ||
      	p.pos.y>gameParams.arena.height || p.pos.y<0)){
        this.points.splice(i,1);
      }
  }
    return this.points.length==0;
  }
}
