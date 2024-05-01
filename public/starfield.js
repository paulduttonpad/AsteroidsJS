class Star{
  constructor(x,y,scalar,field){
    this.pos={x,y};
    this.vel={x:0,y:0}
	this.scalar=scalar;
    this.field=field;
    this.colour=map(this.scalar,0,field.depth,200,255);

    this.rel={x:x+field.x,y:y+field.y};
      
	}
	show(){
      if (this.onScreen()){
        if (random(1)<0.5){
          stroke(255);
        } else {
          stroke(this.colour);
        }
		strokeWeight(this.scalar);
		point(this.rel.x,this.rel.y);
      }
    }
  update(){
    this.pos.x+=this.vel.x*this.scalar;
    this.pos.y+=this.vel.y*this.scalar;
    this.edges();
    this.rel.x=this.pos.x+this.field.x;
    this.rel.y=this.pos.y+this.field.y;
  }
  edges(){
    if (this.pos.x<0){
      this.pos.x=this.field.width;
    } else if (this.pos.x>this.field.width){
      this.pos.x=0;
    }
    if (this.pos.y<0){
      this.pos.y=this.field.height;
    } else if (this.pos.y>this.field.height){
      this.pos.y=0;
    }
  }
  onScreen(){
    return (this.pos.x>0 &&
           this.pos.x<width &&
           this.pos.y>0 &&
           this.pos.y<height);
  }

}

class StarField{
  constructor(starCount=100,
               depth=4,
               x=0,
               y=0,
               w=width,
               h=height,
               vel={x:0,y:0}){
    this.x=x;
    this.y=y;
    this.width=w;
    this.height=h;
    this.depth=depth;
    this.stars=[];
    this.vel=vel;
    for (let i=0;i<starCount;i++){
      this.stars.push(new Star(random(this.width),random(this.height),random(this.depth),this));
    }  
    
    // Sort the stars into size order so the larger stars draw on top of the smaller ones
    
    this.stars.sort(function(a,b){
      return a.scalar-b.scalar;
    });
    
  }
  
  show(){
    for (let star of this.stars){ 
    star.show();
  }
  }
     
  update(){
    for (let star of this.stars){ 
      star.vel=this.vel;
      star.update();
    }
  }  
  setVel(vel,y){
    if (vel.x!=undefined){
      this.vel=vel;
    } else {
      this.vel.x=vel;
      this.vel.y=y;
    }
  }
}

