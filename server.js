const { ServerLoop } = require('./server-loop');
const Asteroid = require('./asteroid');
const Laser = require('./laser');
const Ship = require('./ship');
const Powerup = require('./powerup');
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

// Per-client cache of the last compact world state sent to each socket.
// Regular packets only include changed entities and removed ids.
const clientSnapshots = new Map();
let worldVersion = 0;
const fullSnapshotEveryFrames = 60 * 10;
const shipBroadcastIntervalMs = 100; // max 10 movement broadcasts per second per ship
const POWERUP_LEVEL_CAP = 50;
const POWERUP_LEVELS_PER_LASER = 5;
const LASER_SPREAD_DEGREES = 10;
const POWERUP_DROP_CHANCE = 0.02;
const HEALTH_POWERUP_DROP_CHANCE = 0.01;
const SHIELD_POWERUP_DROP_CHANCE = 0.02;
const SHIELD_POWERUP_DURATION = 60 * 7;
const MAX_HEALTH = 250;
const pendingShipBroadcasts = new Map();
const shipBroadcastTimers = new Map();
const lastShipBroadcastAt = new Map();
const sessionShipColours = new Map();

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
let powerups=[];
let walls=[];

let express = require('express');
let app = express();
let server = app.listen(port);

function indexShips(){
  shipIndex={};
  for (let i=0;i<ships.length;i++) {
    const ship=ships[i];
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
    const newShip = new Ship(-1000,-1000,0,socket.id);
    newShip.colour = getSessionShipColour(socket.id);
    ships.push(newShip);
    indexShips();
    console.log('Client Count: '+io.engine.clientsCount);
    sendData(socket);
    p.loop();

    socket.on('ship', shipMsg);
    function shipMsg(data){
      // console.log(data);
      const ship=ships[shipIndex[socket.id]];
      if (ship==undefined){
        sendData(socket);
        return;
      }
      if (data.pos!=undefined){
        ship.pos.x=data.pos.x;
        ship.pos.y=data.pos.y;
        ship.vel.x=data.vel.x;
        ship.vel.y=data.vel.y;
        ship.heading=data.heading;
        ship.thrustOn=data.thrustOn;
        ship.r=data.r;
        ship.explode=data.explode;
        if (isValidShipColour(data.colour)) {
          ship.colour=normaliseShipColour(data.colour);
          sessionShipColours.set(socket.id, ship.colour);
        } else {
          ship.colour=getSessionShipColour(socket.id);
        }
        queueShipBroadcast(socket.id, ship);
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
              reduceShipPowerupLevel(ships[shipIndex[id]], 2);
            }
            if (asteroid.r>gameParams.asteroidSize.min) {
              Asteroid.split(engine,gameParams,asteroids,asteroid,ships[shipIndex[id]].vel);
            }
            maybeDropPowerup(asteroid);
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
          worldVersion++;
          const datatosend=Ship.sendLifeData(ships);
        }
      }
    }

    socket.on('fire', fire);
    function fire(data){
      const firingShip = ships[shipIndex[data.id]];
      if (!firingShip || firingShip.explode) return;

      const laserProfile = getPoweredLaserProfile(data.r, firingShip);
      for (const heading of getLaserHeadings(data.heading, laserProfile.count)) {
        const laser = new Laser(data.pos.x,data.pos.y,laserProfile.radius,heading,data.id,data.vel.x,data.vel.y);
        const x=Math.cos(heading);
        const y=Math.sin(heading);

        laser.pos=addVectors(laser.pos,{x:x*laserProfile.radius,y:y*laserProfile.radius});
        laser.vel=addVectors(laser.vel,{x:x*20,y:y*20});

        lasers.push(laser);
      }
      worldVersion++;
      // Laser creation is sent in the next deltadata packet.
    }

    socket.on('hitall', function() {
      for (const asteroid of asteroids){
        asteroid.hit={id:socket.id,vel:null};
      }
      worldVersion++;
    });

    socket.on('powerup', function() {
      const s = ships[shipIndex[socket.id]];
      if (!s || s.explode) return;
      s.powerupLevel = Math.min(POWERUP_LEVEL_CAP, Math.max(1, s.powerupLevel || 1) + 1);
      worldVersion++;
    });

    socket.on('disconnect', function() {
      console.log(new Date().toString());
      console.log('Got disconnect: '+socket.id);
      clientSnapshots.delete(socket.id);
      pendingShipBroadcasts.delete(socket.id);
      lastShipBroadcastAt.delete(socket.id);
      lastShipBroadcastAt.delete(socket.id + ':key');
      sessionShipColours.delete(socket.id);
      const timer = shipBroadcastTimers.get(socket.id);
      if (timer) clearTimeout(timer);
      shipBroadcastTimers.delete(socket.id);
      for (let i=ships.length-1;i>=0;i--){
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
      worldVersion++;
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
        worldVersion++;
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
    for (const asteroid of asteroids){
      qtree.insert(new Point(asteroid.pos.x,asteroid.pos.y,asteroid));
    }

    for (let i=lasers.length-1;i>=0;i--){
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
        const asteroid=p.userData;
        if (asteroid.collides(laser)){
          laser.life-=0.5/(laser.r/3);
          asteroid.hit={id:laser.id,vel:{x:laser.vel.x*0.2,y:laser.vel.y*0.2}};
          break;
        }
      }
      for (const s of ships){
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
        worldVersion++;
      }
    }

    for (let i=powerups.length-1;i>=0;i--){
      const powerup = powerups[i];
      powerup.update(ping, ships, gameParams);
      let collected = false;
      for (const s of ships){
        if (!s.explode && powerup.collides(s)){
          if (powerup.type === 'HEALTH') {
            s.life = Math.min(MAX_HEALTH, s.life + (powerup.health || 50));
          } else if (powerup.type === 'SHIELD') {
            s.shield = Math.max(0, s.shield || 0) + (powerup.shield || SHIELD_POWERUP_DURATION);
          } else {
            s.powerupLevel = Math.min(POWERUP_LEVEL_CAP, Math.max(1, s.powerupLevel || 1) + powerup.level);
            s.score += 100;
          }
          powerups.splice(i,1);
          collected = true;
          worldVersion++;
          break;
        }
      }
      if (!collected && powerup.life <= 0){
        powerups.splice(i,1);
        worldVersion++;
      }
    }

    for (let i=asteroids.length-1;i>=0;i--){
      const hit = asteroids[i].hit;
      if (hit != false){
        const scoringShip = ships[shipIndex[hit.id]];
        if (scoringShip != undefined){
          scoringShip.score++;
        }

        if (asteroids[i].r>gameParams.asteroidSize.min) {
          Asteroid.split(engine,gameParams,asteroids,asteroids[i],hit.vel);
        }
        maybeDropPowerup(asteroids[i]);
        Asteroid.removeAsteroid(engine,asteroids,asteroids[i]);
        if (asteroids.length==0){
          nextLevel();
        }
        worldVersion++;
      }
    }

    for (const s of ships){
      let otherPoints=qtree.query(new Rectangle(s.pos.x,s.pos.y,gameParams.asteroidSize.max*2,gameParams.asteroidSize.max*2));

      if (!s.explode){
        for (let p of otherPoints){
          const asteroid=p.userData;
          if (asteroid.collides(s)){
            if (!s.explode){
              if (s.shield<=0){
                s.life-=Math.ceil(asteroid.r*0.5);
                reduceShipPowerupLevel(s, 1);
              }
              if (asteroid.r>gameParams.asteroidSize.min) {
                Asteroid.split(engine,gameParams,asteroids,asteroid,s.vel);
              }
              maybeDropPowerup(asteroid);
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

    if (p.frameCount % sendFrame == 0) {
      sendDeltas(io);
    }

    if (p.frameCount % fullSnapshotEveryFrames == 0) {
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

  function maybeDropPowerup(asteroid){
    if (!asteroid) return;
    if (random(1) < POWERUP_DROP_CHANCE) {
      powerups.push(new Powerup(asteroid.pos.x, asteroid.pos.y));
    }
    if (random(1) < HEALTH_POWERUP_DROP_CHANCE) {
      powerups.push(new Powerup(asteroid.pos.x, asteroid.pos.y, 'HEALTH'));
    }
    if (random(1) < SHIELD_POWERUP_DROP_CHANCE) {
      powerups.push(new Powerup(asteroid.pos.x, asteroid.pos.y, 'SHIELD'));
    }
  }

  function reduceShipPowerupLevel(ship, amount){
    if (!ship) return;
    ship.powerupLevel = Math.max(1, (ship.powerupLevel || 1) - amount);
  }

  function getPoweredLaserProfile(requestedRadius, ship){
    const baseRadius = typeof requestedRadius === 'number' && Number.isFinite(requestedRadius) ? requestedRadius : 10;
    const powerupLevel = clampPowerupLevel(ship && Number.isFinite(ship.powerupLevel) ? ship.powerupLevel : 1);
    const step = getPowerupCycleStep(powerupLevel);
    return {
      count:getPowerupLaserCount(powerupLevel),
      radius:baseRadius + step*4
    };
  }

  function getPowerupLaserCount(powerupLevel){
    const cappedLevel = clampPowerupLevel(powerupLevel);
    return Math.min(12, Math.ceil(cappedLevel / POWERUP_LEVELS_PER_LASER));
  }

  function getPowerupCycleStep(powerupLevel){
    const cappedLevel = clampPowerupLevel(powerupLevel);
    return ((cappedLevel - 1) % POWERUP_LEVELS_PER_LASER) + 1;
  }

  function getLaserHeadings(baseHeading, count){
    const heading = typeof baseHeading === 'number' && Number.isFinite(baseHeading) ? baseHeading : 0;
    const laserCount = Math.max(1, Math.min(12, count || 1));
    const spreadRadians = LASER_SPREAD_DEGREES * Math.PI / 180;
    const centreOffset = (laserCount - 1) / 2;
    const headings = [];
    for (let i=0;i<laserCount;i++) {
      headings.push(heading + (i - centreOffset) * spreadRadians);
    }
    return headings;
  }

  function clampPowerupLevel(powerupLevel){
    if (typeof powerupLevel !== 'number' || !Number.isFinite(powerupLevel)) return 1;
    return Math.max(1, Math.min(POWERUP_LEVEL_CAP, Math.floor(powerupLevel)));
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
    for (const s of ships){
      if (s.shield<100){
        s.shield=100;
      }
    }
    resetGame();
  }



  function sendData(socket){
    const startValue = socket != undefined ? socket.id : false;
    const data = buildFullSnapshot(startValue);

    if (socket != undefined){
      rememberSnapshot(socket.id, data);
      socket.compress(true).emit('alldata', data);
    } else {
      for (const [id] of io.sockets.sockets) {
        rememberSnapshot(id, data);
      }
      datatosend = {label:'alldata', data:data};
    }
  }

  function buildFullSnapshot(startValue=false){
    return {
      start:startValue,
      version:worldVersion,
      gameParams:gameParams,
      asteroids:asteroids.map(a => compactAsteroid(a.getData()).full),
      ships:ships.map(s => s.getData()),
      lasers:lasers.map(l => { const d = l.getData(); d.key = laserKey(l); return d; }),
      powerups:powerups.map(p => p.getData())
    };
  }

  function sendDeltas(io){
    if (io.engine.clientsCount === 0) return;

    for (const [id, socket] of io.sockets.sockets) {
      const previous = clientSnapshots.get(id);
      if (!previous) {
        sendData(socket);
        continue;
      }

      const current = buildCompactSnapshot();
      const payload = {
        version:worldVersion,
        asteroids:{add:[], update:[], remove:[]},
        ships:{add:[], update:[], remove:[]},
        lasers:{add:[], update:[], remove:[]},
        powerups:{add:[], update:[], remove:[]}
      };
      let changed = false;

      changed = diffEntitySet('asteroids', previous, current, payload, changed);
      changed = diffEntitySet('lasers', previous, current, payload, changed);
      changed = diffEntitySet('powerups', previous, current, payload, changed);
      changed = diffShipStatusOnly(previous, current, payload, changed);

      if (previous.gameParamsKey !== current.gameParamsKey) {
        payload.gameParams = gameParams;
        changed = true;
      }

      if (changed) {
        clientSnapshots.set(id, current);
        socket.compress(true).emit('deltadata', payload);
      }
    }
  }

  function diffEntitySet(name, previous, current, payload, changed){
    const previousMap = previous[name] || new Map();
    const currentMap = current[name] || new Map();

    for (const [id, entity] of currentMap) {
      const old = previousMap.get(id);
      if (!old) {
        payload[name].add.push(entity.full);
        changed = true;
      } else if (old.key !== entity.key) {
        payload[name].update.push(entity.delta);
        changed = true;
      }
    }

    for (const id of previousMap.keys()) {
      if (!currentMap.has(id)) {
        payload[name].remove.push(id);
        changed = true;
      }
    }
    return changed;
  }

  function diffShipStatusOnly(previous, current, payload, changed){
    const previousMap = previous.ships || new Map();
    const currentMap = current.ships || new Map();

    for (const [id, entity] of currentMap) {
      const old = previousMap.get(id);
      if (!old) {
        payload.ships.add.push(entity.full);
        changed = true;
      } else if (old.statusKey !== entity.statusKey) {
        // Ship movement/position is no longer sent in the regular world tick.
        // Movement is pushed separately by queueShipBroadcast(), capped at 10/sec.
        payload.ships.update.push(entity.statusDelta);
        changed = true;
      }
    }

    for (const id of previousMap.keys()) {
      if (!currentMap.has(id)) {
        payload.ships.remove.push(id);
        changed = true;
      }
    }
    return changed;
  }

  function queueShipBroadcast(socketId, ship){
    if (!ship) return;

    const packet = compactShip(ship.getData()).movementDelta;
    const nextKey = stableStringify(packet);
    const oldKey = lastShipBroadcastAt.get(socketId + ':key');
    if (oldKey === nextKey) return;

    pendingShipBroadcasts.set(socketId, packet);
    const now = Date.now();
    const lastSentAt = lastShipBroadcastAt.get(socketId) || 0;
    const waitMs = Math.max(0, shipBroadcastIntervalMs - (now - lastSentAt));

    if (waitMs === 0) {
      flushShipBroadcast(socketId);
      return;
    }

    if (!shipBroadcastTimers.has(socketId)) {
      const timer = setTimeout(() => {
        shipBroadcastTimers.delete(socketId);
        flushShipBroadcast(socketId);
      }, waitMs);
      shipBroadcastTimers.set(socketId, timer);
    }
  }

  function flushShipBroadcast(socketId){
    const packet = pendingShipBroadcasts.get(socketId);
    if (!packet) return;

    pendingShipBroadcasts.delete(socketId);
    lastShipBroadcastAt.set(socketId, Date.now());
    lastShipBroadcastAt.set(socketId + ':key', stableStringify(packet));

    const sourceSocket = io.sockets.sockets.get(socketId);
    if (sourceSocket) {
      // Only other clients need this packet; the source client is already predicting itself.
      sourceSocket.broadcast.compress(true).volatile.emit('shipdata', packet);
    }
  }


  function getSessionShipColour(socketId){
    const existing = sessionShipColours.get(socketId);
    if (isValidShipColour(existing)) return existing;

    const colour = colourFromId(socketId);
    sessionShipColours.set(socketId, colour);
    return colour;
  }

  function normaliseShipColour(colour){
    return {
      R:clampColourChannel(colour.R),
      G:clampColourChannel(colour.G),
      B:clampColourChannel(colour.B)
    };
  }

  function clampColourChannel(value){
    if (typeof value !== 'number' || !Number.isFinite(value)) return 255;
    return Math.max(0, Math.min(255, value));
  }

  function colourFromId(id){
    // Deterministic non-white fallback. This avoids the temporary white server
    // placeholder ever leaking into full snapshots/deltas if a client refreshes
    // and its first colour packet has not arrived yet.
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

  function isValidShipColour(colour){
    return !!colour &&
      typeof colour.R === 'number' && Number.isFinite(colour.R) &&
      typeof colour.G === 'number' && Number.isFinite(colour.G) &&
      typeof colour.B === 'number' && Number.isFinite(colour.B);
  }

  function rememberSnapshot(socketId, fullSnapshot){
    clientSnapshots.set(socketId, compactFromFullSnapshot(fullSnapshot));
  }

  function compactFromFullSnapshot(fullSnapshot){
    const snapshot = emptyCompactSnapshot();
    snapshot.gameParamsKey = stableStringify(gameParams);
    for (const asteroid of fullSnapshot.asteroids) snapshot.asteroids.set(String(asteroid.id), compactAsteroid(asteroid));
    for (const laser of fullSnapshot.lasers) snapshot.lasers.set(laser.key || laserKey(laser), compactLaser(laser));
    for (const powerup of fullSnapshot.powerups || []) snapshot.powerups.set(String(powerup.id), compactPowerup(powerup));
    for (const ship of fullSnapshot.ships) snapshot.ships.set(String(ship.id), compactShip(ship));
    return snapshot;
  }

  function buildCompactSnapshot(){
    const snapshot = emptyCompactSnapshot();
    snapshot.gameParamsKey = stableStringify(gameParams);
    for (const asteroid of asteroids) snapshot.asteroids.set(String(asteroid.id), compactAsteroid(asteroid.getData()));
    for (const laser of lasers) { const key = laserKey(laser); const full = laser.getData(); full.key = key; snapshot.lasers.set(key, compactLaser(full)); }
    for (const powerup of powerups) snapshot.powerups.set(String(powerup.id), compactPowerup(powerup.getData()));
    for (const ship of ships) snapshot.ships.set(String(ship.id), compactShip(ship.getData()));
    return snapshot;
  }

  function emptyCompactSnapshot(){
    return {gameParamsKey:'', asteroids:new Map(), ships:new Map(), lasers:new Map(), powerups:new Map()};
  }

  function compactAsteroid(full){
    // Send raw JavaScript number precision for asteroid movement metadata.
    // Client-side smoothing/dead-reckoning handles visual stability instead
    // of relying on lossy server-side rounding.
    const delta = {
      id:String(full.id),
      pos:{x:r(full.pos.x), y:r(full.pos.y)},
      vel:{x:r(full.vel.x), y:r(full.vel.y)},
      heading:r(full.heading),
      rotation:r(full.rotation)
    };
    const fullPacket = Object.assign({}, full, delta);
    if (typeof full.r === 'number') fullPacket.r = r(full.r);
    return {full:fullPacket, delta, key:stableStringify(delta)};
  }

  function compactLaser(full){
    const key = full.key || laserKey(full);
    const delta = {
      key,
      id:String(full.id),
      pos:{x:r(full.pos.x), y:r(full.pos.y)},
      vel:{x:r(full.vel.x), y:r(full.vel.y)},
      life:r(full.life, 3),
      r:r(full.r, 2),
      heading:r(full.heading, 3),
      colour:full.colour
    };
    return {full:Object.assign({}, full, delta), delta, key:stableStringify(delta)};
  }

  function compactShip(full){
    const movementDelta = {
      id:String(full.id),
      pos:{x:r(full.pos.x), y:r(full.pos.y)},
      vel:{x:r(full.vel.x), y:r(full.vel.y)},
      thrustOn:!!full.thrustOn,
      heading:r(full.heading, 3),
      explode:!!full.explode,
      explodePct:r(full.explodePct || 0, 3),
      r:full.r,
      colour:full.colour
    };
    const statusDelta = {
      id:String(full.id),
      score:full.score,
      life:full.life,
      shield:full.shield,
      powerupLevel:full.powerupLevel || 1,
      explode:!!full.explode,
      explodePct:r(full.explodePct || 0, 3),
      colour:full.colour
    };
    const fullDelta = Object.assign({}, movementDelta, statusDelta);
    return {
      full:Object.assign({}, full, fullDelta),
      delta:fullDelta,
      movementDelta,
      selfDelta:statusDelta,
      statusDelta,
      key:stableStringify(fullDelta),
      movementKey:stableStringify(movementDelta),
      statusKey:stableStringify(statusDelta)
    };
  }

  function compactPowerup(full){
    const delta = {
      id:String(full.id),
      type:full.type || 'POWERUP',
      pos:{x:r(full.pos.x), y:r(full.pos.y)},
      vel:{x:r(full.vel.x), y:r(full.vel.y)},
      r:r(full.r, 2),
      level:full.level || 1,
      health:full.health || 50,
      life:r(full.life, 2),
      colour:full.colour
    };
    return {full:Object.assign({}, full, delta), delta, key:stableStringify(delta)};
  }

  function laserKey(laser){
    if (!laser._netKey) {
      laser._netKey = [laser.id, r(laser.heading, 3), r(laser.pos.x), r(laser.pos.y), Date.now(), Math.random().toString(36).slice(2,7)].join(':');
    }
    return laser._netKey;
  }

  function r(value){
    // Full precision mode: keep finite JavaScript numbers exactly as the
    // simulation currently has them. JSON.stringify will serialize the
    // shortest round-trippable decimal representation for the number.
    if (typeof value !== 'number' || !Number.isFinite(value)) return value || 0;
    return value;
  }

  function stableStringify(value){
    return JSON.stringify(value);
  }


  function resetGame(){
    worldVersion++;
    removeWalls();
    createWalls();
    for (var i=0;i<gameParams.asteroidCount;i++){
      if (asteroids.length<gameParams.asteroidMax){
        asteroids.push(new Asteroid(engine,random(gameParams.arena.width),random(gameParams.arena.height),random(gameParams.asteroidSize.min,gameParams.asteroidSize.max)));
      }
    }
  }

  function restartGame(){
    worldVersion++;
    clientSnapshots.clear();
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
    powerups=[];
    resetGame();
  }

}



const serverLoop = new ServerLoop().start(sketch);



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


