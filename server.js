const p5 = require('node-p5');
const Asteroid = require('./asteroid');
const Laser = require('./laser');
const Ship = require('./ship');
const {Quadtree,Rectangle} = require('./quadtree');
const Matter = require('matter-js');

const port = 10000;

// module aliases
var Engine = Matter.Engine,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;

// create an engine
var engine = Engine.create();

let ping=0;

let datatosend=null;
let socketdatatosend=null;

const sendFrame=10;
let origGameParams;
let gameParams={
  asteroidMax:100,
  asteroidCount:2,
  asteroidSize:{
    min:40,
    max:200
  },
  level:1,
  arena:{
    width:1000,
    height:1000,
    colour:0,
    borderColour:100
  }
}

let asteroids = [];
let ships=[];
let shipIndex={};
let lasers=[];
let walls=[];

let express = require('express');
let app = express();
let server = app.listen(port);

function indexShips(){
  shipIndex={};
  for (i=0;i<ships.length;i++) {
    ship=ships[i];
    shipIndex[ship.id]=i;
  }
}

function sketch(p) {
  app.use(express.static('public'));
  console.log("My socket server is running");
  let socket = require('socket.io');
  let io = socket(server);
  io.sockets.on('connection', newConnection);
  p.noLoop();

  function newConnection(socket) {
    console.log(new Date().toString());
    console.log('new connection: '+socket.id);
    ships.push(new Ship(-1000,-1000,0,socket.id));
    indexShips();
    console.log('Client Count: '+io.engine.clientsCount);
    sendData(socket);
    p.loop();

    socket.on('ship', shipMsg);
    function shipMsg(data){
      // console.log(data);
      ship=ships[shipIndex[socket.id]];
      if (data.pos!=undefined){
        ship.pos.x=data.pos.x;
        ship.pos.y=data.pos.y;
        ship.vel.x=data.vel.x;
        ship.vel.y=data.vel.y;
        ship.heading=data.heading;
        ship.thrustOn=data.thrustOn;
        ship.r=data.r;
        ship.explode=data.explode;
        ship.colour=data.colour;
        socketdatatosend={socket:socket,label:'shipdata',data:data};
      }
      // socket.broadcast.emit('shipdata',data);
    }

    socket.on('hitShip', hitShip);
    function hitShip(data){
      let id=data.shipid;
      let asteroid=Asteroid.getAsteroidById(data.asteroidid,asteroids);
      if (asteroid!=null){
        if (ships[shipIndex[id]]!=undefined){
          if (!ships[shipIndex[id]].explode){
            if (ships[shipIndex[id]].shield<=0){
              ships[shipIndex[id]].life-=Math.ceil(asteroid.r*0.5);
            }
            if (asteroid.r>gameParams.asteroidSize.min) {
              Asteroid.split(engine,gameParams,asteroids,asteroid,ships[shipIndex[id]].vel);
            }
            Asteroid.removeAsteroid(engine,asteroids,asteroid);
            ships[shipIndex[id]].score++;
            if (asteroids.length==0){
              nextLevel();
            }
          }
        }
      }
    }

    socket.on('shieldOn', shieldOn);
    function shieldOn(data){
      // console.log(data);
      if (ships[shipIndex[data.id]]!=undefined){
        if (!ships[shipIndex[data.id]].explode){
          ships[shipIndex[data.id]].shield=data.shield;
          datatosend=Ship.sendLifeData(ships);
        }
      }
    }

    socket.on('fire', fire);
    function fire(data){
      var laser = new Laser(data.pos.x,data.pos.y,data.r,data.heading,data.id,data.vel.x,data.vel.y);
      var x=Math.cos(data.heading);
      var y=Math.sin(data.heading);

      laser.pos=addVectors(laser.pos,{x:x*data.r,y:y*data.r});
      laser.vel=addVectors(laser.vel,{x:x*20,y:y*20});

      lasers.push(laser);
      datatosend=Laser.sendData(lasers);
    }

    socket.on('hitall', function() {
      for (asteroid of asteroids){
        asteroid.hit={id:socket.id,vel:null};
      }
    });

    socket.on('disconnect', function() {
      console.log(new Date().toString());
      console.log('Got disconnect: '+socket.id);
      for (i=ships.length-1;i>=0;i--){
        console.log('Client Count: '+io.engine.clientsCount);
        if (io.engine.clientsCount==0) {
          console.log('Restart and Pause Game');
          restartGame();

          p.noLoop();
        }
        if (ships[i].id==socket.id){
          ships.splice(i,1);
          indexShips();
          break;
        }
      }
      sendData();
    });

    socket.on('needdata', function() {
      sendData();
    });

    socket.on('needstartdata', function() {
      sendData(socket);
    });

    socket.on('newasteroid',function(){
      if (asteroids.length<gameParams.asteroidMax){
        asteroids.push(new Asteroid(engine,random(gameParams.arena.width),random(gameParams.arena.height),random(gameParams.asteroidSize.min,gameParams.asteroidSize.max)));
      }
    });
  }

  p.setup = () => {
    origGameParams = JSON.parse(JSON.stringify(gameParams));
    p.noCanvas();
    p.frameRate(60);

    engine.gravity.y = 0;
    resetGame();
  }

  p.draw = () => {
    ping=60/p.frameRate();
    let qtree = new Quadtree(new Rectangle(gameParams.arena.width/2,gameParams.arena.height/2,gameParams.arena.width/2,gameParams.arena.height/2),4);
    for (asteroid of asteroids){
      qtree.insert(new Point(asteroid.pos.x,asteroid.pos.y,asteroid));
    }

    for (i=lasers.length-1;i>=0;i--){
      let laser = lasers[i];
      laser.update(ping);
      let keepLaser=true;
      if (laser.life<0){
        keepLaser=false;
      }
      if (laser.edges(gameParams)) {
        keepLaser=false;
      }

      let otherPoints=qtree.query(new Rectangle(laser.pos.x,laser.pos.y,gameParams.asteroidSize.max*2,gameParams.asteroidSize.max*2));

      for (let p of otherPoints){
        asteroid=p.userData;
        if (asteroid.collides(laser)){
          laser.life-=0.5/(laser.r/3);
          asteroid.hit={id:laser.id,vel:{x:laser.vel.x*0.2,y:laser.vel.y*0.2}};
          break;
        }
      }
      for (s of ships){
        if (s.id!=laser.id && !s.explode){
          let d=dist(s.pos.x,s.pos.y,laser.pos.x,laser.pos.y);
          if (d<laser.r+s.r){
            if (s.shield<=0){
              s.life-=10;
              if (ships[shipIndex[laser.id]]!=undefined){
                ships[shipIndex[laser.id]].score+=10;
              }
            }
            keepLaser=false;
          }
        }
      }
      if (!keepLaser){
        lasers.splice(i,1);
        sendData();
      }
    }

    for (let i=asteroids.length-1;i>=0;i--){
      if (asteroids[i].hit != false){
        ships[shipIndex[asteroids[i].hit.id]].score++;

        if (asteroids[i].r>gameParams.asteroidSize.min) {
          Asteroid.split(engine,gameParams,asteroids,asteroids[i],asteroids[i].hit.vel);
        }
        Asteroid.removeAsteroid(engine,asteroids,asteroids[i]);
        if (asteroids.length==0){
          nextLevel();
        }
        sendData();
      }
    }

    for (s of ships){
      let otherPoints=qtree.query(new Rectangle(s.pos.x,s.pos.y,gameParams.asteroidSize.max*2,gameParams.asteroidSize.max*2));

      if (!s.explode){
        for (let p of otherPoints){
          asteroid=p.userData;
          if (asteroid.collides(s)){
            if (!s.explode){
              if (s.shield<=0){
                s.life-=Math.ceil(asteroid.r*0.5);
              }
              if (asteroid.r>gameParams.asteroidSize.min) {
                Asteroid.split(engine,gameParams,asteroids,asteroid,s.vel);
              }
              Asteroid.removeAsteroid(engine,asteroids,asteroid);
              s.score++;
              if (asteroids.length==0){
                nextLevel();
              }
              sendData();
            }
            break;
          }
        }

        for (let s2 of ships){
          if (s!=s2 && !s2.explode){
            if (s.collides(s2)){
              if (s.shield<=0){
                s.life-=5;
              }
              if (s2.shield<=0){
                s2.life-=5;
              }
              break;
            }
          }
        }

        if (s.life<=0){
          s.explode=true;
          s.explodePct=0;
        }

      } else {
        s.explodePct+=0.01;
      }
      if (s.shield>0 && s.shield<100000){
        s.shield--;
      }
    }

    if (p.frameCount % 30 == 0) {
      sendData();
    }

    if (datatosend !=null && p.frameCount % 2 == 0) {
      io.compress(true).volatile.emit(datatosend.label,datatosend.data);
      datatosend=null;
    }

    if (socketdatatosend !=null && p.frameCount % 2 == 1) {
      socketdatatosend.socket.compress(true).volatile.emit(socketdatatosend.label,socketdatatosend.data);
      socketdatatosend=null;
    }
    // tick=p.millis();
    let tick=1000/p.frameRate();
    if (tick<200){
      Engine.update(engine,tick);
    }
  }

  function nextLevel(){
    let inc=gameParams.arena.width*0.1;
    if (inc>1000){
      inc=1000;
    }
    gameParams.level++;
    gameParams.arena.width+=inc;
    gameParams.arena.height+=inc;
    gameParams.asteroidSize.max*=1.02;
    gameParams.asteroidCount=p.ceil(gameParams.asteroidCount*1.2);
    for (s of ships){
      if (s.shield<100){
        s.shield=100;
      }
    }
    resetGame();
  }



  function sendData(socket){
    if (socket!=undefined) {
      start=socket.id;
    } else {
      start=false;
    }
    data={
      start:start,
      gameParams:gameParams,
      asteroids:[],
      ships:[],
      lasers:[]
    };
    for (ship of ships){
      data.ships.push(ship.getData());
    }
    for (asteroid of asteroids){
      data.asteroids.push(asteroid.getData());
    }
    for (laser of lasers){
      data.lasers.push(laser.getData());
    }

    if (socket!=undefined){
      // socketdatatosend={socket:socket,label:'alldata',data:data};
      socket.compress(true).volatile.emit('alldata',data);
    } else {
      datatosend={label:'alldata',data:data};
      // io.emit('alldata',data);
    }
  }


  function resetGame(){
    removeWalls();
    createWalls();
    for (var i=0;i<gameParams.asteroidCount;i++){
      if (asteroids.length<gameParams.asteroidMax){
        asteroids.push(new Asteroid(engine,random(gameParams.arena.width),random(gameParams.arena.height),random(gameParams.asteroidSize.min,gameParams.asteroidSize.max)));
      }
    }
  }

  function restartGame(){
    gameParams = JSON.parse(JSON.stringify(origGameParams));
    let removes = [];
    for (let body of engine.world.bodies){
      if (body.label=='ASTEROID' || body.label=='LASER') {
        removes.push(body);
      }
    }
    if (removes.length>0) {
      Composite.remove(engine.world, removes);
    }
    asteroids = [];
    lasers=[];
    resetGame();
  }

}



let p5Instance = p5.createSketch(sketch);



function random(a,b){
  if (b==undefined){
    return Math.random()*a;
  } else if (a==undefined){
    return Math.random();
  } else {return Math.random()*(b-a)+a}

}

function addVectors(a,b){
  return {
    x:a.x+b.x,
    y:a.y+b.y
  };
}

function addVectorsPing(a,b){
  return {
    x:a.x+b.x*ping,
    y:a.y+b.y*ping
  };
}

function dist(x1,y1,x2,y2){
  let a2=(x1-x2) ** 2;
  let b2=(y1-y2) ** 2;
  return Math.sqrt(a2+b2);
}

class Point {
  constructor(x, y, userData) {
    this.x=x;
    this.y=y;
    this.userData = userData;
  }
}

function createWalls(){
  let sizew=gameParams.arena.width;
  let sizeh=gameParams.arena.height;
  walls=[
    Bodies.rectangle(sizew/2, -5000, sizew, 10000, { isStatic: true,restitution: 1,label:'WALL' }),
    Bodies.rectangle(sizew/2, sizeh+5000, sizew, 10000, { isStatic: true,restitution: 1,label:'WALL'  }),
    Bodies.rectangle(sizew+5000, sizeh/2, 10000, sizeh, { isStatic: true,restitution: 1,label:'WALL'  }),
    Bodies.rectangle(-5000, sizeh/2, 10000, sizeh, { isStatic: true,restitution: 1,label:'WALL'  })
  ];
  Composite.add(engine.world, walls);
}
function removeWalls(){
  if (walls.length>0){
    Composite.remove(engine.world, walls);
  }
}


