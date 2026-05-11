// module aliases
const Engine = Matter.Engine,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;

// create an engine
let engine = Engine.create();
engine.gravity.y = 0;

let socket;
let connected = false;

let lasertimer=0;
let ping=0;

let gameParams;
let asteroids = [];
const max_explosions=100;
let explosions=[];
let asteroidCount=0;
let qtree;
let qtreeLimit=4;
let ship;
let ships=[];
let lasers=[];
let powerups=[];
let asteroidImages=[];
let font;
let start=false;
let starField;
let scl=1;
let walls = [];
const shipSendIntervalMs = 100; // send own movement to the server at max 10/sec when moving
let lastShipSendAt = 0;
let lastShipColourSendKey = '';

const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      ua
    )
  ) {
    return "mobile";
  }
  return "desktop";
};

let deviceType=getDeviceType();

function preload(){
  asteroidImages.push(loadImage('asteroid1.jpg'));
  asteroidImages.push(loadImage('asteroid2.jpg'));
  asteroidImages.push(loadImage('asteroid3.jpg'));

  font = loadFont('sofachrome.otf');
}

function resetGame(){
  if (socket){
    socket.disconnect();
  }
  gameParams=null;
  Asteroid.removeAll(asteroids);
  asteroids     = [];
  explosions    = [];
  asteroidCount = 0;
  ship          = null;
  ships         = [];
  lasers        = [];
  powerups      = [];
  start         = false;
  let starCount = floor((width*height)/10000);
  starField=new StarField(starCount,4);

  socket = io.connect(window.location.href); 
  socket.on('alldata',updateAll);
  socket.on('deltadata',updateDelta);
  socket.on('laserdata',laserAll);
  socket.on('move',moveAsteroids);
  socket.on('shipdata',updateShip);
  socket.on('lifedata',updateLife)
}

function updateAll(data){
  let nextLevel=true;
  if (gameParams){
    if (gameParams.level==data.gameParams.level){
      nextLevel=false;
    } 
  }
  gameParams=data.gameParams;
  start=data.start;
  Asteroid.removeAll(asteroids);
  asteroids=[];
  for (let asteroid of data.asteroids){
    asteroids.push(new Asteroid(asteroid));
  }
  lasers=data.lasers;
  powerups=[];
  for (let powerup of data.powerups || []){
    powerups.push(new Powerup(powerup));
  }
  asteroidCount=asteroids.length;
  for (let i=data.ships.length-1;i>=0;i--) {
    let s=data.ships[i];
    if (s.id==socket.id && ship){
      ship.score=s.score;
      ship.life=s.life;
      ship.shield=s.shield;
      ship.powerupLevel=s.powerupLevel || 1;
      ship.explode=s.explode;
      data.ships.splice(i,1);
    }
  }
  ships=data.ships;
  for (const remoteShip of ships) {
    normaliseIncomingShipColour(remoteShip);
    initialiseRemoteShipSmoothing(remoteShip);
  }
  if (nextLevel){
    removeWalls();
    createWalls();
  }
}

function updateDelta(data){
  if (!data) return;
  if (data.gameParams) {
    gameParams = data.gameParams;
    removeWalls();
    createWalls();
  }

  applyAsteroidDelta(data.asteroids);
  applyLaserDelta(data.lasers);
  applyPowerupDelta(data.powerups);
  applyShipDelta(data.ships);
}

function applyAsteroidDelta(delta){
  if (!delta) return;

  for (const id of delta.remove || []) {
    removeAsteroidById(id);
  }

  for (const asteroid of delta.add || []) {
    removeAsteroidById(asteroid.id);
    asteroids.push(new Asteroid(asteroid));
  }

  for (const asteroid of delta.update || []) {
    const local = findById(asteroids, asteroid.id);
    if (!local) {
      socket.compress(true).emit('needdata');
      continue;
    }
    Asteroid.applyNetworkUpdate(local, asteroid);
  }
  asteroidCount = asteroids.length;
}

function applyLaserDelta(delta){
  if (!delta) return;

  for (const key of delta.remove || []) {
    removeLaserByKey(key);
  }

  for (const laser of delta.add || []) {
    removeLaserByKey(laser.key);
    lasers.push(laser);
  }

  for (const laser of delta.update || []) {
    const local = findLaser(laser.key);
    if (!local) {
      socket.compress(true).emit('needdata');
      continue;
    }
    Object.assign(local, laser);
  }
}

function applyPowerupDelta(delta){
  if (!delta) return;

  for (const id of delta.remove || []) {
    removePowerupById(id);
  }

  for (const powerup of delta.add || []) {
    removePowerupById(powerup.id);
    powerups.push(new Powerup(powerup));
  }

  for (const powerup of delta.update || []) {
    const local = findById(powerups, powerup.id);
    if (!local) {
      socket.compress(true).emit('needdata');
      continue;
    }
    Powerup.applyNetworkUpdate(local, powerup);
  }
}

function applyShipDelta(delta){
  if (!delta || !ship) return;

  for (const id of delta.remove || []) {
    removeShipById(id);
  }

  for (const s of delta.add || []) {
    if (s.id == ship.id) {
      updateOwnShipStatus(s);
    } else if (!findById(ships, s.id)) {
      normaliseIncomingShipColour(s);
      initialiseRemoteShipSmoothing(s);
      ships.push(s);
    }
  }

  for (const s of delta.update || []) {
    if (s.id == ship.id) {
      updateOwnShipStatus(s);
      continue;
    }

    const local = findById(ships, s.id);
    if (!local) {
      socket.compress(true).emit('needdata');
      continue;
    }
    normaliseIncomingShipColour(s, local);
    Object.assign(local, s);
  }
}

function updateOwnShipStatus(s){
  if (!ship) return;
  if (s.score !== undefined) ship.score = s.score;
  if (s.life !== undefined) ship.life = s.life;
  if (s.shield !== undefined) ship.shield = s.shield;
  if (s.powerupLevel !== undefined) ship.powerupLevel = s.powerupLevel;
  if (s.explode !== undefined) ship.explode = s.explode;
  if (s.explodePct !== undefined) ship.explodePct = s.explodePct;
  if (isValidShipColour(s.colour)) ship.colour = safeColour(s.colour, ship.id);
}

function findById(list, id){
  return list.find(item => item.id == id);
}

function findLaser(key){
  return lasers.find(laser => laser.key == key);
}

function removeLaserByKey(key){
  for (let i=lasers.length-1;i>=0;i--) {
    if (lasers[i].key == key) {
      lasers.splice(i,1);
    }
  }
}

function removePowerupById(id){
  for (let i=powerups.length-1;i>=0;i--) {
    if (powerups[i].id == id) {
      powerups.splice(i,1);
    }
  }
}

function removeShipById(id){
  for (let i=ships.length-1;i>=0;i--) {
    if (ships[i].id == id) {
      ships.splice(i,1);
    }
  }
}

function removeAsteroidById(id){
  for (let i=asteroids.length-1;i>=0;i--) {
    if (asteroids[i].id == id) {
      Composite.remove(engine.world, [asteroids[i].body]);
      asteroids.splice(i,1);
    }
  }
}

function updateLife(data){
  for (let s2 of data.ships) {
    if (s2.id==ship.id){
      ship.life=s2.life;
      if (s2.powerupLevel !== undefined) ship.powerupLevel=s2.powerupLevel;
      ship.explode=s2.explode;
        } else {
      for (let s of ships){
        if (s.id==s2.id){
          s.life=s2.life;
          s.shield=s2.shield;
          if (s2.powerupLevel !== undefined) s.powerupLevel=s2.powerupLevel;
          s.explode=s2.explode;
        }
      }
    }
  }
}

function laserAll(data){
  lasers=data.lasers;
}

function sendShipUpdateIfMoved(){
  if (!ship || !socket || !socket.connected) return;

  const colour = safeColour(ship.colour, ship.id);
  const colourSendKey = JSON.stringify({R:colour.R,G:colour.G,B:colour.B});
  const mustSendColour = colourSendKey !== lastShipColourSendKey;

  if (!ship.moved && !mustSendColour) return;

  const now = millis();
  if (!mustSendColour && now - lastShipSendAt < shipSendIntervalMs) return;

  lastShipSendAt = now;
  lastShipColourSendKey = colourSendKey;

  const data = ship.getData();
  if (mustSendColour) {
    // Colour is part of the player's session identity, so do not send the
    // initial/changed colour as volatile. If this first packet is dropped the
    // server can keep its temporary white placeholder and broadcast that to
    // reconnecting clients.
    socket.compress(true).emit('ship', data);
  } else {
    socket.compress(true).volatile.emit('ship', data);
  }
}

function updateShip(data){
  if (!data || !ship) return;
  let found=false;
  for (let i=ships.length-1;i>=0;i--) {
    let s=ships[i];
    if (!s || s.id==ship.id){
      ships.splice(i,1);
      continue;
    }
    if (s.id==data.id){
      found=true;
      normaliseIncomingShipColour(data, s);
      prepareShipInterpolation(s, data);
      mergeDefined(s, data);
    }
  }
  if (!found){
    // Movement broadcasts are intentionally partial packets. If we do not have
    // the ship yet, ask for a full snapshot so score/life/colour are restored.
    socket.compress(true).emit('needdata');
  }
}

function mergeDefined(target, source){
  for (const key of Object.keys(source || {})) {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
}

function safeNumber(value, fallback=0){
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isValidShipColour(value){
  return !!value &&
    typeof value.R === 'number' && Number.isFinite(value.R) &&
    typeof value.G === 'number' && Number.isFinite(value.G) &&
    typeof value.B === 'number' && Number.isFinite(value.B);
}

function safeColour(value, id){
  if (isValidShipColour(value)) {
    return {
      R:constrain(value.R, 0, 255),
      G:constrain(value.G, 0, 255),
      B:constrain(value.B, 0, 255)
    };
  }
  return colourFromId(id);
}

function normaliseIncomingShipColour(incoming, existing){
  if (!incoming) return;
  if (isValidShipColour(incoming.colour)) {
    incoming.colour = safeColour(incoming.colour, incoming.id);
    return;
  }
  if (existing && isValidShipColour(existing.colour)) {
    incoming.colour = existing.colour;
    return;
  }
  incoming.colour = colourFromId(incoming.id);
}

function colourFromId(id){
  const str = String(id || 'ship');
  let hash = 2166136261;
  for (let i=0;i<str.length;i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return {
    R:100 + ((hash >>>  0) % 156),
    G:100 + ((hash >>>  8) % 156),
    B:100 + ((hash >>> 16) % 156)
  };
}

function moveAsteroids(data){

  if (asteroids.length==data.asteroids.length){
  for (let i=0;i<data.asteroids.length;i++){
    Asteroid.applyNetworkUpdate(asteroids[i], data.asteroids[i]);
  }}
  else {
    socket.compress(true).emit('needdata');
  }
}

function draw() {
  ping=60/frameRate();
  if (socket.connected && !connected){
    connected=true;
  }
  if (connected && start==socket.id) {
    ship = new Ship(random(gameParams.arena.width),random(gameParams.arena.height),random(-2*PI,2*PI),0);
    start=false;
    return;
  }
  if (start==undefined || ship==undefined){
    socket.compress(true).emit('needstartdata');
  }
  if (ship) {
    if (socket.id) {
      ship.id=socket.id;
    }
    sendShipUpdateIfMoved();
    if (canvas.hasOwnProperty('GL')) {
      translate(-width/2,-height/2);
    }
    background(gameParams.arena.borderColour);
    scale(scl);

    // draw arena
    push();
    translate(0-ship.pos.x+width/2,0-ship.pos.y+height/2,-1);
    fill(gameParams.arena.colour);
    stroke(75);
    strokeWeight(5);
    rectMode(CORNER);
    rect(-20,-20,gameParams.arena.width+40,gameParams.arena.height+40);
    pop();

    //draw starfield
    starField.setVel(-ship.vel.x/8,-ship.vel.y/8);
    starField.update();
    starField.show();  

    push();
    //center ship
    translate(width/2-ship.pos.x,height/2-ship.pos.y);

    // add asteroids and lasers to the quadtree and update the lasers
    qtree = new Quadtree(new Rectangle(gameParams.arena.width/2,gameParams.arena.height/2,gameParams.arena.width/2,gameParams.arena.height/2),qtreeLimit);
    for (const asteroid of asteroids){
      Asteroid.updateNetworkSmoothing(asteroid);
      qtree.insert(new Point(asteroid.pos.x,asteroid.pos.y,asteroid));
    }
    for (var laser of lasers){
      Laser.update(laser);
      qtree.insert(new Point(laser.pos.x,laser.pos.y,laser));
    }
    for (var powerup of powerups){
      Powerup.update(powerup);
      qtree.insert(new Point(powerup.pos.x,powerup.pos.y,powerup));
    }
    // qtree.show();

    //query the quadtree for objects that are on screen
    let onScreen=qtree.query(new Rectangle(ship.pos.x,ship.pos.y,width/2+gameParams.asteroidSize.max,height/2+gameParams.asteroidSize.max));

    //sort objects in size order;
    onScreen.sort(function(a,b){
      return a.userData.r-b.userData.r;
    });
    for (let onScreenPoint of onScreen){

      
      if (onScreenPoint.userData.type=="ASTEROID") {
        // show the asteroid if onscreen and check if it hits the players ship
        let asteroid=onScreenPoint.userData;
        Asteroid.show(asteroid);
        if (Asteroid.isHit(asteroid,ship) && !ship.explode){
          let data = {shipid:ship.id,asteroidid:asteroid.id};
          if (ship.shield<=0){
            explosions.push(new Explosion(ship.pos.x,ship.pos.y,color(ship.colour.R,ship.colour.G,ship.colour.B)));
          }
          explosions.push(new Explosion(asteroid.pos.x,asteroid.pos.y,color(ship.colour.R,ship.colour.G,ship.colour.B)));
          ship.vel.mult(-0.5);
          ship.applyForce(createVector(asteroid.vel.x,asteroid.vel.y).mult(0.5));
          socket.compress(true).emit('hitShip',data);
        }
      } else if (onScreenPoint.userData.type=="POWERUP" || onScreenPoint.userData.type=="HEALTH" || onScreenPoint.userData.type=="SHIELD"){
        Powerup.show(onScreenPoint.userData);
      } else if (onScreenPoint.userData.type=="LASER"){
        // show the laser if onscreen and check if it hits another players ship
        var laser=onScreenPoint.userData;
        Laser.show(laser);
        for (let s of ships) {
          if (s.id!=laser.id){
            if (Ship.isHit(s,laser) && explosions.length<=max_explosions && !s.explode) {
              // if your laser hits another ship show an explosion
              explosions.push(new Explosion(laser.pos.x,laser.pos.y,color(s.colour.R,s.colour.G,s.colour.B)));
            }
          }
        }
        if (ship.id!=laser.id){
          if (ship.isHit(laser) && explosions.length<=max_explosions && !ship.explode){
            // if you are hit by another ships laser show an explosion
            explosions.push(new Explosion(laser.pos.x,laser.pos.y,color(ship.colour.R,ship.colour.G,ship.colour.B)));
          }
        }
      }
    }

    // check for asteroid and laser collisions
    for (var asteroid of asteroids){  
      // for each asteroid query the quadtree for other objects that are close
      let others=qtree.query(new Rectangle(asteroid.pos.x,asteroid.pos.y,gameParams.asteroidSize.max*2,gameParams.asteroidSize.max*2));

      for (let otherPoint of others){
        if (otherPoint.userData.type=="LASER") {
          // if the laser collides with this asteroid then show an explosion (the asteroid laser collision split is delt with by the server)
          let otherLaser=otherPoint.userData;
          if (asteroid != otherLaser && Asteroid.collides(asteroid,otherLaser) && explosions.length<=max_explosions) {
            explosions.push(new Explosion(otherLaser.pos.x,otherLaser.pos.y,color(252,219,137)));
          }
        }
      }
    }

    for (let i=ships.length-1;i>=0;i--){
      let s=ships[i];
      if (s.id==ship.id){
        ships.splice(i,1);
      } else if (!s.explode){
        let otherPoints=qtree.query(new Rectangle(s.pos.x,s.pos.y,gameParams.asteroidSize.max*2,gameParams.asteroidSize.max*2));

        for (let p of otherPoints){
          let asteroid=p.userData;
          if (asteroid.type=="ASTEROID"){
            if (Asteroid.collides(asteroid,s)){
              if (!s.explode){
                if (s.shield<=0){
                  explosions.push(new Explosion(s.pos.x,s.pos.y,color(s.colour.R,s.colour.G,s.colour.B)));
                }
                explosions.push(new Explosion(asteroid.pos.x,asteroid.pos.y,color(s.colour.R,s.colour.G,s.colour.B)));
                }
              break;
            }
          }
        }
        if (ship.collides(s) && !ship.explode && ship.id!=s.id && ship.id!=0){
          if (ship.shield<=0){
            explosions.push(new Explosion(ship.pos.x,ship.pos.y,color(s.colour.R,s.colour.G,s.colour.B)));
          }
          if (s.shield<=0){
            explosions.push(new Explosion(s.pos.x,s.pos.y,color(ship.colour.R,ship.colour.G,ship.colour.B)));
          }
          if (s.vel){
            ship.pos.sub(ship.vel.copy().mult(2));
            if (ship.collides(s)){
              ship.pos.sub(p5.Vector.fromAngle(ship.heading).mult(ship.r*2));
            }
            ship.vel.mult(-0.5);
            ship.applyForce(createVector(s.vel.x,s.vel.y).mult(0.5));
          }
        }
      }
    }

    drawOtherShips();

    // check for mobile/touch screen input and thust te ship in the direction of the touch and fire
    if (deviceType != 'desktop' && !ship.explode) {
      if (millis()-lasertimer>ship.getLaserFireDelay()){
        ship.fire(10);
        lasertimer=millis();
      } 
      if (touches.length>0) {
        ship.thrustOn=true;
        let touch=createVector(touches[0].x-width/2,touches[0].y-height/2);
        ship.heading=touch.heading();
      }
    }

    // Draw the ship
    ship.show();
    ship.update();

    // Draw any explosions (if on screen)
    for (let i=explosions.length-1;i>=0;i--){
      let explosion=explosions[i];
      if (explosion.pos.x>ship.pos.x-width/2-200 &&
          explosion.pos.x<ship.pos.x+width/2+200 &&
          explosion.pos.y>ship.pos.y-height/2-200 &&
          explosion.pos.y<ship.pos.y+height/2+200) {

          explosion.show();
      }
      if (explosion.update()) {
        explosions.splice(i,1);
      }
    }
    pop();

    onScreenDisplay();

    // if L or SPACE is pushed fire 5 times a second with size 10 lasers
    if ((keyIsDown(76) || keyIsDown(32)) && millis()-lasertimer>ship.getLaserFireDelay()){
      ship.fire(10);
      lasertimer=millis();
    }
    // if M is pushed fire 5 times a second with size 50 lasers
    if (keyIsDown(77) && millis()-lasertimer>ship.getLaserFireDelay()){
      ship.fire(50);
      lasertimer=millis();
    }

  }
  let tick=1000/frameRate();
  if (tick<200){
    Engine.update(engine,tick);
  }
}

function touchEnded(){
  ship.thrustOn=false;
}

function touchStarted(){
  if (touches.length>0){
    if (touches[0].x>width-30 && touches[0].y<30) {
      ship.shieldOn(100000);
    }
  }
}
function onScreenDisplay(){
  push();
  translate(width-10,5,10);
  textAlign(RIGHT);
  noStroke();
  fill(240);
  textSize(20);

  textFont(font);
  text('Level '+gameParams.level,-5,20);
  const ownColour = safeColour(ship.colour, ship.id);
  const ownPowerupLevel = safeNumber(ship.powerupLevel, 1);
  const ownLife = safeNumber(ship.life);
  const ownScore = safeNumber(ship.score);
  fill(ownColour.R,ownColour.G,ownColour.B);
  text(ownPowerupLevel.toString()+":"+ownLife.toString()+":"+ownScore.toString(),-5,40);
  pop();
  if (ship.explode){
    ship.vel.x=0;
    ship.vel.y=0;
    push();
    translate(width/2,height/2,10);
    fill(240);
    textSize(width/12);
    textFont(font);
    noStroke();
    textAlign(CENTER,CENTER);
    text('GAME OVER',0,0);
    textSize(20);
    text('Refresh to restart',0,height/2-20);
    pop();
  }
  let counter=0;
  for (let s of ships){
    if (s && s.id!=ship.id){
      const colour = safeColour(s.colour, s.id);
      const powerupLevel = safeNumber(s.powerupLevel, 1);
      const life = safeNumber(s.life);
      const score = safeNumber(s.score);
      push();
      translate(width-10,5+(counter+2)*20,10);
      textAlign(RIGHT);
      noStroke();
      fill(colour.R,colour.G,colour.B);
      textSize(20);
      textFont(font);
      text(powerupLevel.toString()+":"+life.toString()+":"+score.toString(),-5,20);
      pop();
      counter++;
    }
  }
}
function keyPressed(){
  if (ship) {
  switch (key){
  case 'ArrowUp':
  case 'w':
    ship.thrustOn=true;
    break;
  case 'ArrowLeft':
  case 'a':
    ship.turning=-0.05;
    break;
  case 'ArrowRight':
  case 'd':
    ship.turning=0.05;
    break;
  case 'n':
    socket.compress(true).emit('newasteroid');
    break;
  case 'p':
  case 'P':
    socket.compress(true).emit('powerup');
    break;
  case 'h':
    socket.compress(true).emit('hitall');
    let onScreen=qtree.query(new Rectangle(ship.pos.x,ship.pos.y,width/2+gameParams.asteroidSize.max,height/2+gameParams.asteroidSize.max));
    for (let onScreenPoint of onScreen){
    if (onScreenPoint.userData.type=="ASTEROID" && explosions.length<=max_explosions) {
      let asteroid=onScreenPoint.userData;
      explosions.push(new Explosion(asteroid.pos.x,asteroid.pos.y,color(252,219,137)));
    }
  }
    break;
  case 'e':
    resetGame();
    break;
  case 'c':
    ship.colour={R:random(100,255),G:random(100,255),B:random(100,255)};
    break;
  case 's':
    ship.shieldOn(100000);
    break;
  case 'z':
    scl=constrain(scl-0.1,0.1,2);
    break;
  case 'x':
    scl=constrain(scl+0.1,0.1,2);
    break;
  }
}
}

function keyReleased(){
  // console.log(key);
  if (ship) {
  switch (key){
  case 'ArrowLeft':
  case 'ArrowRight':
  case 'a':
  case 'd':
    ship.turning=0;
    break;
  case 'ArrowUp':
  case 'w':
    ship.thrustOn=false;
    break;
  }
}
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
