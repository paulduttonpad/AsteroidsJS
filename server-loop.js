'use strict';

class ServerLoop {
  constructor() {
    this.frameCount = 0;
    this._targetFps = 60;
    this._timer = null;
    this._draw = null;
  }

  noCanvas() {
    // Compatibility no-op for the previous node-p5 server sketch wrapper.
  }

  frameRate(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      this._targetFps = value;
      if (this._timer) {
        this.noLoop();
        this.loop();
      }
    }
    return this._targetFps;
  }

  ceil(value) {
    return Math.ceil(value);
  }

  noLoop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  loop() {
    if (this._timer || typeof this._draw !== 'function') return;

    const intervalMs = Math.max(1, Math.round(1000 / this._targetFps));
    this._timer = setInterval(() => {
      this.frameCount++;
      this._draw();
    }, intervalMs);

    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }

  start(sketch) {
    if (typeof sketch !== 'function') {
      throw new TypeError('ServerLoop.start requires a sketch function');
    }

    sketch(this);

    if (typeof this.setup === 'function') {
      this.setup();
    }

    this._draw = typeof this.draw === 'function' ? this.draw.bind(this) : null;
    return this;
  }
}

module.exports = { ServerLoop };
