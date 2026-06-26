let spriteAnimator;
let gifAnimator;
let animator; // points to active animator (sprite or gif)
let mode = 'sprite'; // 'sprite' | 'gif'
let bubble;
let lastBubble = '';
let toolLockUntil = 0;
let idleStart = 0;
let idleAnimTimer = null;
let permissionPending = false;
let permissionTimer = null;

let lastCoreSignal = '';
let lastOverlay = '';
let inputPending = false;
let lastEventTime = 0;
let fallbackTimer = null;
let tauriListenerActive = false;

let clickStart = null;

function switchMode() {
  mode = (mode === 'sprite') ? 'gif' : 'sprite';
  animator = (mode === 'sprite') ? spriteAnimator : gifAnimator;
  document.getElementById('pet-container').classList.toggle('gif-mode', mode === 'gif');
  // Restart current animation on the new animator
  if (animator.currentAnimation) {
    const current = animator.currentAnimation;
    animator.currentAnimation = null; // force re-play
    animator.play(current);
  }
}

async function init() {
  const resp = await fetch('validation.json');
  const validationData = await resp.json();
  const spriteEl = document.getElementById('sprite');
  const gifContainer = document.getElementById('gif-container');
  const bubbleEl = document.getElementById('bubble');
  spriteAnimator = new SpriteAnimator(spriteEl, validationData);
  gifAnimator = new GifAnimator(gifContainer);
  animator = spriteAnimator;
  bubble = new Bubble(bubbleEl);
  window._petBubble = bubble;
  // Use a getter so _petAnimator always reflects active animator
  Object.defineProperty(window, '_petAnimator', { get: () => animator });
  window._switchMode = switchMode;

  const ipc = window.__TAURI_INTERNALS__;

  // Passthrough (click-through) helpers — used for drag and other interactions
  const disablePassthrough = () => {
    try { if (ipc && ipc.invoke) ipc.invoke('set_passthrough', { enabled: false }); } catch (_) {}
  };
  // Unified mouse handling: drag on move, click on release without move
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    disablePassthrough();
    clickStart = { x: e.clientX, y: e.clientY, time: Date.now() };
  });

  document.addEventListener('mousemove', (e) => {
    if (!clickStart) return;
    const dx = Math.abs(e.clientX - clickStart.x);
    const dy = Math.abs(e.clientY - clickStart.y);
    if (dx > 3 || dy > 3) {
      clickStart = null;
      try { if (ipc && ipc.invoke) ipc.invoke('start_drag'); } catch (_) {}
    }
  });

  document.addEventListener('mouseup', () => {
    clickStart = null;
    try { if (ipc && ipc.invoke) ipc.invoke('notify_drag_end'); } catch (_) {}
  });

  // Right-click on pet -> quick menu
  const onContextMenu = (e) => {
    e.preventDefault();
    bubble.showQuickMenu();
  };
  spriteEl.addEventListener('contextmenu', onContextMenu);
  gifContainer.addEventListener('contextmenu', onContextMenu);

  // Double-click on pet -> toggle movement mode
  let lastClickTime = 0;
  const onDoubleClick = async (e) => {
    const now = Date.now();
    if (now - lastClickTime < 400) {
      // Double-click detected
      try {
        const ipc = window.__TAURI_INTERNALS__;
        if (ipc && ipc.invoke) {
          const newMode = await ipc.invoke('toggle_movement_mode');
          showMovementMode(newMode);
        }
      } catch (_) {}
    }
    lastClickTime = now;
  };
  spriteEl.addEventListener('dblclick', onDoubleClick);
  gifContainer.addEventListener('dblclick', onDoubleClick);

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Keyboard shortcut: Ctrl+G toggles GIF/sprite mode
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'g') {
      e.preventDefault();
      switchMode();
    }
  });

  // 1. 优先注册所有 Tauri 事件监听器，确保不会丢失 Rust 发来的启动 state-change 事件
  await setupEventListener();
  await setupAdapterListener();

  // 2. 初始化动画与气泡（手动触发一次欢迎动画，兜底 Rust 丢失的事件）
  animator.play('waving');
  bubble.show('爱弥斯已上线~');

  // 3. 3秒后自动恢复到常态 idle
  setTimeout(() => {
    if (animator.currentAnimation === 'waving') {
      animator.play('idle');
    }
  }, 3000);

  setupInteractiveInput();
  setupQuickMenu();
  setupConfirmButtons();
  startFallbackPoll();

  window._sendUserInput = sendUserInput;
}

// ========== Tauri event listener (primary channel) ==========

function setupEventListener() {
  const ipc = window.__TAURI_INTERNALS__;
  if (!ipc || typeof ipc.listen !== 'function') {
    console.warn('Tauri IPC not available, state updates via polling only');
    return;
  }
  try {
    ipc.listen('state-change', (event) => {
      tauriListenerActive = true;
      lastEventTime = Date.now();
      const { animation, bubble: bubbleText, core_signal, tool_label, overlay,
              input_type, options } = event.payload;

      if (animation) {
        animator.play(animation);
      }

      updateBubbleStates(bubbleText, core_signal, overlay, input_type, options);
      handleIdleAnimation(animation, overlay);

      lastCoreSignal = core_signal;
      lastOverlay = overlay || '';
    });
  } catch (e) {
    console.warn('Tauri listen failed, using polling only', e);
  }
}

// ========== Movement mode display ==========

function showMovementMode(mode) {
  const modeText = mode === 'coding_follow' ? '编码跟随' : '自由漫游';
  bubble.show(`运动模式: ${modeText}`);
}

// ========== Adapter status listener ==========

function setupAdapterListener() {
  const ipc = window.__TAURI_INTERNALS__;
  if (!ipc || typeof ipc.listen !== 'function') return;

  try {
    ipc.listen('adapter-change', (event) => {
      const payload = event.payload || {};
      const name = payload.name || payload.active;

      if (name) {
        bubble.show(`已连接 ${name}~`);
        animator.play('waving');
        setTimeout(() => {
          if (animator.currentAnimation === 'waving') {
            animator.play('idle');
          }
        }, 3000);
      } else {
        bubble.show('未检测到 CLI 工具');
        animator.play('idle');
      }
    });
  } catch (e) {
    console.warn('adapter listener failed', e);
  }
}

async function invokeAdapterCommand(command, args) {
  const ipc = window.__TAURI_INTERNALS__;
  if (ipc && ipc.invoke) {
    return ipc.invoke(command, args || {});
  }

  if (command === 'get_adapter_status' || command === 'scan_adapters_now') {
    const r = await fetch('http://127.0.0.1:9527/api/adapter/list');
    return r.json();
  }

  if (command === 'set_adapter_auto') {
    const r = await fetch('http://127.0.0.1:9527/api/adapter/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'auto' }),
    });
    return r.json();
  }
}

function showAdapterStatus(status) {
  const active = status.active || '无';
  const mode = status.mode === 'manual' ? '手动' : '自动';
  const detected = status.detected && status.detected.length > 0
    ? status.detected.join(', ')
    : '未检测到';
  bubble.showPersistent(`适配器: ${active}\n模式: ${mode}\n检测: ${detected}`);
}

// ========== Fallback polling (2s, only when Tauri events stale) ==========

function startFallbackPoll() {
  if (fallbackTimer) return;
  fallbackTimer = setInterval(async () => {
    if (tauriListenerActive && Date.now() - lastEventTime < 3000) return;

    try {
      const r = await fetch('http://127.0.0.1:9527/api/current');
      if (r.ok) {
        const data = await r.json();
        if (data.animation) {
          animator.play(data.animation);
        }
        if (data.core_signal) {
          updateBubbleStates(data.bubble, data.core_signal, data.overlay);
          handleIdleAnimation(data.animation, data.overlay);
        }
      }
    } catch (_) {}
    try {
      const pr = await fetch('http://127.0.0.1:9527/api/user/pending');
      if (pr.ok) {
        const pd = await pr.json();
        if (pd.waiting && !inputPending) {
          inputPending = true;
          const it = pd.input_type || 'text';
          const opts = (pd.input_type === 'select') ? pd.options : null;
          bubble.showInteractive('等待输入...', it, opts, '输入...');
          bubble.startPendingPoll();
        }
      }
    } catch (_) {}
  }, 2000);
}

// ========== Bubble state machine (core_signal-driven) ==========

function updateBubbleStates(bubbleText, coreSignal, overlay, inputType, options) {
  // Reflect current overlay on container for CSS targeting
  document.getElementById('pet-container').dataset.overlay = overlay || '';

  if (overlay === 'input') {
    if (!inputPending) {
      inputPending = true;
      const it = inputType || 'text';
      const opts = (inputType === 'select') ? options : null;
      bubble.showInteractive(bubbleText || '请输入...', it, opts, '输入...');
      bubble.startPendingPoll();
    }
    return;
  }

  if (overlay === 'sleep') {
    if (inputPending) {
      inputPending = false;
      bubble.hideInteractive();
    }
    if (permissionPending) {
      exitPermission();
    }
    lastBubble = bubbleText || 'zzz...';
    bubble.showPersistent(lastBubble);
    return;
  }

  if (inputPending && overlay !== 'input') {
    inputPending = false;
    bubble.hideInteractive();
  }

  if (overlay === 'permission') {
    if (!permissionPending) {
      permissionPending = true;
      permissionTimer = setInterval(() => {
        if (permissionPending && bubble) {
          bubble.hide();
          bubble.show('等待指示...');
        }
      }, 300);
      setTimeout(() => {
        if (permissionPending) { exitPermission(); bubble.hide(); }
      }, 120000);
    }
    if (bubbleText && bubbleText !== lastBubble) {
      lastBubble = bubbleText;
      bubble.showPersistent(bubbleText);
    }
    return;
  }

  if (permissionPending && overlay !== 'permission') {
    exitPermission();
  }

  const now = Date.now();

  if (coreSignal === 'running') {
    if (bubbleText && bubbleText !== lastBubble) {
      lastBubble = bubbleText;
      bubble.showPersistent(bubbleText);
      toolLockUntil = now + 1200;
    }
    return;
  }

  if (coreSignal === 'waiting') {
    if (bubbleText && bubbleText !== lastBubble) {
      lastBubble = bubbleText;
      bubble.showPersistent(bubbleText);
    }
    return;
  }

  if (coreSignal === 'ready') {
    if (now < toolLockUntil) {
      return;
    }
    lastBubble = '';
    if (bubbleText) {
      bubble.show(bubbleText);
    }
    return;
  }

  if (coreSignal === 'idle') {
    if (now < toolLockUntil) {
      return;
    }
    lastBubble = '';
    if (bubbleText) {
      bubble.show(bubbleText);
    } else {
      bubble.hide();
    }
    return;
  }
}

function exitPermission() {
  permissionPending = false;
  if (permissionTimer) {
    clearInterval(permissionTimer);
    permissionTimer = null;
  }
}

// ========== Interactive input handlers ==========

function setupInteractiveInput() {
  const sendBtn = document.getElementById('ask-send');
  const backBtn = document.getElementById('ask-back');
  const askInput = document.getElementById('ask-input');

  sendBtn.addEventListener('click', () => {
    const val = askInput.value.trim();
    if (val) {
      sendUserInput(val, 'text');
    }
  });

  backBtn.addEventListener('click', () => {
    sendUserInput('__cancel__', 'text');
  });

  askInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = askInput.value.trim();
      if (val) {
        sendUserInput(val, 'text');
      }
    }
  });
}

function setupConfirmButtons() {
  document.getElementById('ask-confirm-yes').addEventListener('click', () => {
    sendUserInput('yes', 'confirm');
  });
  document.getElementById('ask-confirm-no').addEventListener('click', () => {
    sendUserInput('no', 'confirm');
  });
}

async function sendUserInput(value, type) {
  try {
    await fetch('http://127.0.0.1:9527/api/user/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, type: type || 'text' }),
    });
    inputPending = false;
  } catch (e) {
    console.error('sendUserInput failed:', e);
  }
}

// ========== Quick menu ==========

function setupQuickMenu() {
  const menu = document.getElementById('quick-menu');

  document.querySelectorAll('.quick-menu-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      menu.classList.add('hidden');

      const ipc = window.__TAURI_INTERNALS__;
      switch (action) {
        case 'message':
          bubble.showWithInput('输入要发送的消息');
          break;
        case 'adapter-status': {
          const status = await invokeAdapterCommand('get_adapter_status');
          showAdapterStatus(status);
          break;
        }
        case 'adapter-auto': {
          const status = await invokeAdapterCommand('set_adapter_auto');
          showAdapterStatus(status);
          break;
        }
        case 'adapter-scan': {
          const status = await invokeAdapterCommand('scan_adapters_now');
          showAdapterStatus(status);
          break;
        }
        case 'movement-mode': {
          try {
            const ipc = window.__TAURI_INTERNALS__;
            if (ipc && ipc.invoke) {
              const newMode = await ipc.invoke('toggle_movement_mode');
              showMovementMode(newMode);
            }
          } catch (_) {}
          break;
        }
        case 'sleep':
          try { if (ipc && ipc.invoke) ipc.invoke('hide_window'); } catch (_) {}
          break;
        case 'exit':
          try { if (ipc && ipc.invoke) ipc.invoke('exit_app'); } catch (_) {}
          break;
        case 'toggle-mode':
          switchMode();
          break;
      }
    });
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#quick-menu') && !e.target.closest('#sprite') && !e.target.closest('#gif-container')) {
      bubble.hideQuickMenu();
    }
  });
}

// ========== Idle animation cycling ==========

function handleIdleAnimation(animation, overlay) {
  if (animation !== 'idle' || overlay) {
    idleStart = 0;
    if (idleAnimTimer) {
      clearInterval(idleAnimTimer);
      idleAnimTimer = null;
    }
    return;
  }

  if (!idleStart) idleStart = Date.now();
  if (Date.now() - idleStart <= 8000 || idleAnimTimer) return;

  const idleAnims = ['jumping', 'waving'];
  let idx = 0;
  idleAnimTimer = setInterval(() => {
    if (idx < idleAnims.length) {
      animator.play(idleAnims[idx]);
      idx++;
      return;
    }

    animator.play('idle');
    clearInterval(idleAnimTimer);
    idleAnimTimer = null;
    idleStart = Date.now();
  }, 3000);
}

// ========== User message submission ==========

async function sendUserMessage(text) {
  try {
    await fetch('http://127.0.0.1:9527/api/user/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: text }),
    });
    bubble.show('消息已发送');
  } catch (e) {
    bubble.show('发送失败');
  }
}

// Auto-start
document.addEventListener('DOMContentLoaded', init);
