class GifAnimator {
  constructor(containerEl) {
    this.el = document.createElement('img');
    this.el.id = 'gif-sprite';
    this.el.alt = '';
    this.el.draggable = false;
    containerEl.appendChild(this.el);

    this.currentAnimation = null;

    // Map pet states to GIF file paths
    this.stateMap = {
      'idle': 'idle2.gif',
      'waving': 'idle1.gif',  // 挥手状态：使用 idle1.gif
      'jumping': 'idle2.gif', // 跳跃状态：改用 idle2.gif (避免与 waving 重复冲突)
      'running': 'move.gif',
      'drag': 'drag.gif',
      'screen1': 'screen1.gif',
      'screen2': 'screen2.gif',
      'screen3': 'screen3.gif',
      'screen4': 'screen4.gif',
      'screen5': 'screen5.gif',
      'screen6': 'screen6.gif',
      'screen7': 'screen7.gif',
    };
  }

  // Normalize numbered variants: "idle1" -> "idle", "idle2" -> "idle"
  _resolveState(state) {
    const base = state.replace(/\d+$/, '');
    return (base in this.stateMap) ? base : state;
  }

  play(state) {
    const resolved = this._resolveState(state);
    if (resolved === this.currentAnimation) return;
    this.currentAnimation = resolved;

    const gifFile = this.stateMap[resolved] || 'idle1.gif';
    // Append timestamp to force reload when switching back to same GIF name
    this.el.src = `assets/gifs/${gifFile}?t=${Date.now()}`;
  }

  stop() {
    this.el.src = '';
    this.currentAnimation = null;
  }
}

window.GifAnimator = GifAnimator;
