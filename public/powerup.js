class Powerup{
  constructor(powerup) {
    this.type=powerup.type || "POWERUP";
    this.id=powerup.id;
    this.pos={x:powerup.pos.x,y:powerup.pos.y};
    this.vel={x:powerup.vel.x,y:powerup.vel.y};
    this.r=powerup.r || (powerup.type === 'HEALTH' || powerup.type === 'SHIELD' ? 16 : 14);
    this.level=powerup.level || 1;
    this.health=powerup.health || 50;
    this.shield=powerup.shield || 60*15;
    this.life=powerup.life || 1;
    this.colour=powerup.colour || (powerup.type === 'HEALTH' ? {R:255,G:0,B:0} : powerup.type === 'SHIELD' ? {R:40,G:140,B:255} : {R:255,G:220,B:60});
    this.net = {
      startTime: Powerup.now(),
      lastUpdateAt: Powerup.now(),
      duration: 100,
      fromPos: {x:this.pos.x, y:this.pos.y},
      toPos: {x:this.pos.x, y:this.pos.y},
      vel: {x:this.vel.x, y:this.vel.y}
    };
  }

  static applyNetworkUpdate(powerup, data){
    if (data.pos || data.vel) {
      const now = Powerup.now();
      const previousUpdateAt = powerup.net && powerup.net.lastUpdateAt ? powerup.net.lastUpdateAt : now;
      const duration = Powerup.clamp(now - previousUpdateAt, 80, 250);
      const currentPos = {x:powerup.pos.x, y:powerup.pos.y};

      powerup.net = {
        startTime: now,
        lastUpdateAt: now,
        duration: duration,
        fromPos: currentPos,
        toPos: {
          x: Powerup.safeNumber(data.pos && data.pos.x, currentPos.x),
          y: Powerup.safeNumber(data.pos && data.pos.y, currentPos.y)
        },
        vel: {
          x: Powerup.safeNumber(data.vel && data.vel.x, powerup.vel ? powerup.vel.x : 0),
          y: Powerup.safeNumber(data.vel && data.vel.y, powerup.vel ? powerup.vel.y : 0)
        }
      };

      powerup.vel = {x:powerup.net.vel.x,y:powerup.net.vel.y};
    }
    if (data.r !== undefined) powerup.r=data.r;
    if (data.type !== undefined) powerup.type=data.type;
    if (data.level !== undefined) powerup.level=data.level;
    if (data.health !== undefined) powerup.health=data.health;
    if (data.shield !== undefined) powerup.shield=data.shield;
    if (data.life !== undefined) powerup.life=data.life;
    if (data.colour) powerup.colour=data.colour;
  }

  static update(powerup){
    Powerup.updateNetworkSmoothing(powerup);
  }

  static updateNetworkSmoothing(powerup){
    if (!powerup || !powerup.net) return;

    const now = Powerup.now();
    const elapsed = Math.max(0, now - powerup.net.startTime);
    const frameDelta = elapsed / (1000 / 60);
    const targetPos = {
      x: powerup.net.toPos.x + powerup.net.vel.x * frameDelta,
      y: powerup.net.toPos.y + powerup.net.vel.y * frameDelta
    };
    const t = Powerup.smoothStep(Powerup.clamp(elapsed / powerup.net.duration, 0, 1));

    powerup.pos = {
      x: Powerup.lerp(powerup.net.fromPos.x, targetPos.x, t),
      y: Powerup.lerp(powerup.net.fromPos.y, targetPos.y, t)
    };
    powerup.vel = {x:powerup.net.vel.x,y:powerup.net.vel.y};
  }

  static now(){
    if (typeof millis === 'function') return millis();
    return Date.now();
  }

  static clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  static lerp(a, b, t){
    return a + (b - a) * t;
  }

  static smoothStep(t){
    return t * t * (3 - 2 * t);
  }

  static safeNumber(value, fallback){
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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
    } else if (powerup.type === 'SHIELD') {
      strokeWeight(4);
      fill(0,40,90,flashAlpha);
      circle(0,0,powerup.r*2);
      noStroke();
      fill(255,255,255,flashAlpha + 20);
      textAlign(CENTER,CENTER);
      textSize(powerup.r*1.5);
      textStyle(BOLD);
      text('S',0,1);
      textStyle(NORMAL);
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
