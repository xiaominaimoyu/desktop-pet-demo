# 桌宠项目问题诊断与修改方案说明书

本报告针对桌宠项目（Desktop_Pet）中 **“启动时无法播放挥手动画与气泡”**、**“GIF 模式下无限重复播放 idle1.gif”** 以及 **“连接 CLI 工具后桌宠状态无变化”** 三大核心问题进行了深入的源码分析，并提供了具体的修改方案和代码框架。

---

## 一、 问题诊断与根本原因分析

### 1. 启动时挥手动画未播放 & 重复播放 `idle1.gif`
在 `src/app.js`、`src/gif-animator.js` 以及后台 Rust 逻辑中，存在以下几处协同 Bug，共同导致了这一现象：

*   **Bug A：事件监听器注册滞后，丢失启动事件**  
    在 `src/app.js` 的 `init()` 函数中：
    ```javascript
    async function init() {
      // ... 
      animator.play('idle');
      bubble.show('桌宠已上线~');
      
      setupEventListener(); // 此时才注册 state-change 监听器
      setupAdapterListener();
      // ...
    }
    ```
    Rust 后端（`main.rs`）在启动桌宠窗口后会极快地触发一次 `state-change` 事件（携带 `waving` 动画与 `爱弥斯已上线~` 气泡）。由于前端 JS 此时尚未执行 `setupEventListener()`，该启动事件在注册前便已发送完毕，导致前端**丢失了启动状态事件**。

*   **Bug B：GIF 模式下状态映射冲突 (硬编码缺陷)**  
    在 `src/gif-animator.js` 的构造函数中，状态映射表如下：
    ```javascript
    this.stateMap = {
      'idle': 'idle2.gif',
      'waving': 'idle1.gif',  // 挥手和跳跃全部映射到了 idle1.gif
      'jumping': 'idle1.gif', // 导致 GIF 模式下无法区分，看起来都是同一种动作
      // ...
    };
    ```
    即使前端接收到了 `waving`（挥手）或 `jumping`（跳跃）状态，在 GIF 模式下渲染出来的依然是 `idle1.gif`，导致桌宠动作单一且怪异。

*   **Bug C：闲置动画循环定时器未清除，导致无限循环**  
    在 `src/app.js` 的 `handleIdleAnimation` 方法中，当桌宠处于 idle 状态超过 8 秒时，会触发一个定时器依次播放：`jumping` $ightarrow$ `waving` -> `idle`。  
    然而，在播放完 `waving` 并准备重置回 `idle` 时（`idx >= idleAnims.length * 2`），代码调用了 `animator.play('idle')`，但**没有清除闲置动画的定时器 `idleAnimTimer`**！  
    这导致定时器在后台无限运行，周而复始地触发动作切换，在 GIF 模式下由于 Bug B 映射冲突，最终表现为**桌宠无限重复播放 `idle1.gif`**。

---

### 2. 连接 CLI 工具（适配器）后桌宠状态无变化
*   **Bug D：适配器变更监听器只改变了文本气泡，未触发宠物体态变化**  
    在 `src/app.js` 的 `setupAdapterListener()` 中：
    ```javascript
    function setupAdapterListener() {
      listen('adapter-change', (event) => {
        const { active, mode, detected } = event.payload;
        if (active) {
          bubble.show(`已连接 ${active}~`); // 仅展示了气泡文本！
        } else {
          bubble.show('未检测到 CLI 工具');
        }
      });
    }
    ```
    当外部 CLI 工具通过适配器连接或断开时，前端仅更新了气泡的文字，**从未调用 `animator.play('waving')` 或其他状态切换函数**。这导致桌宠没有任何身体动作反馈，状态变化不够生动。

---

## 二、 修改方案与代码框架

> **注意：** 请按照以下框架和步骤对本地代码进行修改，无需变动 Rust 后端。

### 方案 1：修复 GIF 动画映射 (`src/gif-animator.js`)
为了在 GIF 模式下能明显区分不同状态，我们需要解除 `waving` 和 `jumping` 对同一 GIF 的硬编码绑定。
若项目中没有独立的 `waving.gif`，建议进行交错映射（例如让 `waving` 映射到 `idle1.gif`，而让 `jumping` 映射到 `idle2.gif`，或者反之，确保动作有视觉差异）。

**修改框架：**
```javascript
// 定位到 src/gif-animator.js 的 constructor 内：
this.stateMap = {
  'idle': 'idle2.gif',
  'waving': 'idle1.gif',  // 挥手状态：使用 idle1.gif
  'jumping': 'idle2.gif', // 跳跃状态：改用 idle2.gif (避免与 waving 重复冲突)
  'running': 'move.gif',
  'drag': 'drag.gif',
  // ... 其他保持不变
};
```

---

### 方案 2：修复启动加载顺序与闲置定时器 Bug (`src/app.js`)

#### 1. 调整 `init` 函数，防止丢失启动事件，并添加初始化挥手
通过将监听器注册提前，并在注册完成后添加一个主动的启动挥手延时，确保桌宠能完美展示“挥手 + 气泡”的欢迎效果。

**修改框架：**
```javascript
async function init() {
  // 1. 优先注册所有 Tauri 事件监听器，确保不会丢失 Rust 发来的启动 state-change 事件
  await setupEventListener();
  await setupAdapterListener();

  // 2. 延迟执行初始化，给监听器准备时间，或者在此处手动触发一次欢迎动画
  // 这样既能兜底 Rust 丢失的事件，又可以确保启动时能展示挥手动作
  animator.play('waving');
  bubble.show('爱弥斯已上线~');

  // 3. 3秒后自动恢复到常态 idle
  setTimeout(() => {
    if (animator.currentAnimation === 'waving') {
      animator.play('idle');
    }
  }, 3000);

  // 4. 开启兜底轮询（可选）
  startFallbackPoll();
}
```

#### 2. 修复 `handleIdleAnimation` 定时器未清除的问题
在状态回归 `idle` 时，必须显式清除并释放 `idleAnimTimer` 定时器，停止无效的后台重播。

**修改框架：**
```javascript
function handleIdleAnimation(state, overlay) {
  // 当从非 idle 状态切走时，清理定时器
  if (state !== 'idle' || overlay) {
    if (idleAnimTimer) {
      clearInterval(idleAnimTimer);
      idleAnimTimer = null;
    }
    return;
  }

  // 处于 idle 时，启动 8 秒后的动作循环
  if (!idleAnimTimer) {
    let idx = 0;
    const idleAnims = ['jumping', 'waving'];
    
    idleAnimTimer = setInterval(() => {
      if (idx < idleAnims.length) {
        // 第一轮：播放 jumping
        animator.play(idleAnims[idx]);
        idx++;
      } else if (idx < idleAnims.length * 2) {
        // 第二轮：播放 waving
        animator.play(idleAnims[idx - idleAnims.length]);
        idx++;
      } else {
        // 第三轮：重置回常态 idle，并【必须】清除定时器，结束循环！
        animator.play('idle');
        clearInterval(idleAnimTimer); // <-- 核心修复：防止无限循环 idle1.gif
        idleAnimTimer = null;
      }
    }, 3000); // 每 3 秒切换一次动作
  }
}
```

---

### 方案 3：实现 CLI 连接状态的体态联动 (`src/app.js`)
在监听到 `adapter-change` 事件时，如果检测到 CLI 工具（适配器）成功连接，桌宠立即播放 `waving`（挥手）动画进行庆祝，并在几秒后自动恢复。

**修改框架：**
```javascript
function setupAdapterListener() {
  const { listen } = window.__TAURI__.event;
  
  listen('adapter-change', (event) => {
    const { active, mode, detected } = event.payload;
    
    if (active) {
      // 1. 展示连接成功的气泡
      bubble.show(`已连接 ${active}~`);
      
      // 2. 联动体态：播放挥手动画
      animator.play('waving');
      
      // 3. 3秒后自动恢复至 idle
      setTimeout(() => {
        if (animator.currentAnimation === 'waving') {
          animator.play('idle');
        }
      }, 3000);
      
    } else {
      // 连接断开时的反馈
      bubble.show('未检测到 CLI 工具');
      animator.play('idle');
    }
  });
}
```

---

## 三、 测试与验证方法

按照上述框架修改代码后，可通过以下步骤进行完整的功能流程测试：

1. **测试双击启动 / 启动初始化：**
   * 双击运行桌宠编译后的 `.exe`。
   * **预期现象：** 桌宠顺利出现在屏幕上，立刻展示**挥手动画**（如果是 Sprite 模式为 Spritesheet 挥手帧；如果是 GIF 模式由于映射修复，将能明显看出有别于 idle 的动作），同时气泡框弹出并显示 **“爱弥斯已上线~”**。3 秒后桌宠动作平滑切回 **idle** 常态。

2. **测试闲置循环：**
   * 让桌宠保持静止 8 秒以上。
   * **预期现象：** 8 秒后，桌宠依次执行跳跃动画和挥手动画，并在播放完毕后**顺利静止回到 idle 状态**，不再无限重复在同一种诡异的 `idle1.gif` 中。

3. **测试连接 CLI 工具联动：**
   * 启动您的外部 CLI 工具（或通过模拟器发送 `adapter-change` 状态，将 `active` 设为连接的 CLI 名称）。
   * **预期现象：** 桌宠气泡展示 **“已连接 <工具名>~”** 的同时，身体立刻**播放挥手动画**进行反馈，3 秒后自动恢复为常态。
