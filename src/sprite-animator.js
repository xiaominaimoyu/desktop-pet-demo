class SpriteAnimator {
  constructor(spriteEl, validationData) {
    this.el = spriteEl;
    this.cellW = 192;
    this.cellH = 208;
    this.cols = 8;
    this.frameInterval = 180;
    this.currentAnimation = null;
    this.frameIndex = 0;
    this.timer = null;

    // Build frame map from validation.json: state -> [{row, col}, ...]
    this.frameMap = {};
    for (const cell of validationData.cells) {
      if (!cell.used) continue;
      if (!this.frameMap[cell.state]) {
        this.frameMap[cell.state] = [];
      }
      this.frameMap[cell.state].push({ row: cell.row, column: cell.column });
    }
  }

  // Normalize state names: "idle1" -> "idle", "idle2" -> "idle", etc.
  // Backend sends numbered variants (idle1/idle2/idle3) but the sprite sheet
  // uses base names (idle). Strip trailing digits for frame lookup.
  _resolveState(state) {
    const base = state.replace(/\d+$/, '');
    return this.frameMap[base] ? base : state;
  }

  play(state) {
    const resolved = this._resolveState(state);
    if (resolved === this.currentAnimation) return;
    this.currentAnimation = resolved;
    this.frameIndex = 0;
    this.stop();
    this._tick();

    const frames = this.frameMap[resolved];
    if (frames && frames.length > 1) {
      this.timer = setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % frames.length;
        this._tick();
      }, this.frameInterval);
    }
  }

  _tick() {
    const frames = this.frameMap[this.currentAnimation];
    if (!frames || frames.length === 0) return;
    const frame = frames[this.frameIndex % frames.length];
    const x = frame.column * this.cellW;
    const y = frame.row * this.cellH;
    this.el.style.backgroundPosition = `-${x}px -${y}px`;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

window.SpriteAnimator = SpriteAnimator;
