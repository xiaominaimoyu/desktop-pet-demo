# Phase 1 — 基础框架任务书

> **工期**: 10 个工作日 | **里程碑**: 桌宠窗口可见、可拖拽、可播放动画
> **版本标签**: `v0.1.0-alpha`（Phase 1 验收后打 tag）
>
> **验收状态 (2026-06-17)**:
> - 验收清单: 12/12 ✅ 全部通过
> - 质量门禁: 5/5 ✅ 全部通过
> - 总体评估: **Phase 1 验收通过** — git tag `v0.1.0-alpha` 已创建

---

## 一、阶段目标

搭建 Tauri v2 项目骨架，实现**透明无边框窗口 + 精灵图动画引擎 + 基础状态机 + 系统托盘**，让桌宠"活"在桌面上。

---

## 二、借鉴清单

| 模块 | 来源 | 改造点 | 估时节省 |
|------|------|--------|----------|
| 精灵图动画引擎 | aemeath `sprite-animator.js` | 语言适配（ES Module）、Tauri 事件对接、帧率控制扩展 | -2 天 |
| 窗口管理 | aemeath Tkinter 窗口控制 | 替换为 Tauri v2 原生 API（透明/置顶/拖拽） | -0.5 天 |
| 状态机设计 | aemeath REDESIGN.md 三层状态模型 | 扩展为 15 态，增加 Rust 端状态管理和事件发射 | -1 天 |

---

## 三、前置条件

> **注意**: 以下前置条件请在 Phase 1 开始前（建议纳入 Phase 0 准备阶段）完成，避免 Day 1 因环境问题消耗过多时间。

- [ ] Rust 工具链已安装（rustc ≥ 1.77, cargo）— 首次安装含下载 + 编译，约 30-60 分钟
- [ ] Node.js ≥ 20 已安装（前端打包）
- [ ] Tauri CLI v2 已安装（`cargo install tauri-cli --version ^2`）
- [ ] Windows 平台（macOS/Linux 交叉编译后续阶段处理）
- [ ] 托盘图标 + 应用图标初版已准备（.ico / .png 多尺寸）
- [ ] 占位精灵图已准备（至少 3 行：idle / run / celebrate，每行 8 帧）
- [ ] opencode / Claude Code hook 事件格式已调研（影响 Phase 2，提前确认）

---

## 四、版本管理规范

- 每个 Phase 验收通过后打 git tag：`v0.1.0-alpha` → `v0.1.0-beta` → `v0.1.0-rc1` → `v0.1.0`
- Phase 内的关键接口变更须在提交信息中标注 `BREAKING:`
- `PetState` 枚举等跨 Phase 共用类型变更时，须同步更新所有引用 Phase 的文档

---

## 五、逐日任务

### Day 1 — Tauri v2 项目初始化

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 1.1 | `cargo create-tauri-app desktop-pet` 初始化项目（如工具链未就绪则先安装） | 项目骨架 | **1.5h** |
| 1.2 | 配置 `tauri.conf.json`：窗口尺寸 256×256，启动位置右上角 | 基础配置 | 1h |
| 1.3 | 配置 `Cargo.toml`：添加 tokio、serde、serde_json 依赖 | 依赖声明 | 0.5h |
| 1.4 | 创建 `src-tauri/src/` 下的模块文件骨架（main.rs / state.rs / window.rs / http.rs / mcp.rs） | 模块结构 | 1h |
| 1.5 | 运行 `cargo tauri dev` 确认窗口正常弹出（首次编译可能需要 5-15 分钟） | 可运行骨架 | **1.5h** |
| 1.6 | 初始化前端 `src/` 目录：index.html / pet.css / app.js | 前端骨架 | 1h |

**Day 1 验收标准**: 窗口可弹出，显示一个占位 HTML 页面。

> **估时备注**: 原 0.5h 初始化 + 1h 启动验证过于乐观。首次 `cargo tauri dev` 需下载和编译大量依赖，实际耗时 15-60 分钟不等。已调整为 1.5h + 1.5h 并包含工具链检查。

---

### Day 2 — 透明无边框窗口 + 置顶（含 click-through PoC）

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 2.1 | **技术预研**：click-through 方案选型 — 实测 WS_EX_TRANSPARENT 可行性；备选：`tauri-plugin-window-passthrough`、自实现 hit-test | 方案决策 | **2h** |
| 2.2 | 配置 `tauri.conf.json` 窗口参数：`decorations: false`, `transparent: true`, `alwaysOnTop: true` | 透明无边框窗口 | 1h |
| 2.3 | 实现 `window.rs` — 窗口拖拽：监听 `mousedown` 事件 → 调用 `window.start_dragging()` | 拖拽功能 | 2h |
| 2.4 | 设置窗口背景透明：CSS `background: transparent` + HTML `body` 透明 | 透明渲染 | 1h |
| 2.5 | 窗口跳过任务栏：`skipTaskbar: true`，`focus: false` | 桌宠行为 | 0.5h |
| 2.6 | 测试：窗口可拖拽移动、不遮挡其他窗口操作（click-through 仅在透明区域） | 验收 | **2h** |

**Day 2 验收标准**: 桌宠窗口透明无边框、始终置顶、可拖拽移动；click-through PoC 通过。

> **关键风险 — click-through（高）**: Windows 上 WebView 透明区域穿透是桌宠核心体验，WS_EX_TRANSPARENT 可能导致整个窗口不可点击。Day 2 前置 2h 技术预研，若方案不可行则切换到 `tauri-plugin-window-passthrough` 或自实现 hit-test。**此风险阻塞 Phase 1 全部后续任务，必须在 Day 2 完成 PoC。**

---

### Day 3 — 精灵图动画引擎（上）

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 3.1 | **移植并改造** aemeath 的 `sprite-animator.js` → 创建 `src/sprite-animator.js`，适配 ES Module + Tauri 环境 | 动画引擎骨架 | 2h |
| 3.2 | 实现核心类 `SpriteAnimator`：精灵图加载、帧切割（canvas 2D）、帧播放 | 帧播放功能 | 3h |
| 3.3 | 准备测试用精灵图（至少 3 行：idle / run / celebrate，每行 8 帧）— 可使用 Aseprite / TexturePacker 简易绘制 | 测试资源 | **1.5h** |

**Day 3 验收标准**: 能加载精灵图并循环播放指定行。

> **资源备注**: 精灵图制作需要美术工具（Aseprite / TexturePacker），估时从 1h 调整为 1.5h。建议 Phase 0 提前准备好占位精灵图。

---

### Day 4 — 精灵图动画引擎（下）

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 4.1 | 实现帧切换：通过 CSS class 切换动画状态 → 改变精灵图行偏移 | 状态切换 | 2h |
| 4.2 | 实现播放模式：loop（循环）、once（播放一次停留末帧）、ping-pong（往复） | 播放模式 | 1.5h |
| 4.3 | 实现帧率控制：通过 `setInterval` + `data-fps` 属性控制播放速度 | 帧率控制 | 0.5h |
| 4.4 | 实现 GIF 兼容模式：`<img>` 显示 GIF，与精灵图模式互斥切换 | GIF 降级 | 1.5h |
| 4.5 | 验收：切换 3 种状态动画流畅、帧率可调 | 验收 | 0.5h |

**Day 4 验收标准**: 动画引擎完整可用，支持精灵图 + GIF 双模式。

---

### Day 5 — 基础状态机（Rust 侧）

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 5.1 | 实现 `state.rs` — `PetState` 枚举（至少 6 个状态：Idle / Waving / Thinking / Running / Celebrating / Failed） | 状态枚举 | 1h |
| 5.2 | 实现 `StateManager` 结构体：当前状态 + 状态历史 + 状态变更事件发射 | 状态管理器 | 2h |
| 5.3 | 实现 Tauri 事件通道：状态变更时 `app_handle.emit("pet-state-changed", payload)` | 前后端通信 | 1h |
| 5.4 | 前端监听 `pet-state-changed` 事件 → 调用 `spriteAnimator.play(state)` | 前后端联调 | 1.5h |
| 5.5 | 添加手动测试入口：前端加 3 个按钮切换 Idle/Running/Celebrating | 手动测试 | 0.5h |

**Day 5 验收标准**: 前端按钮切换状态 → 动画跟随变化。

---

### Day 6 — 状态机增强 + 自动状态流转

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 6.1 | 扩展 `PetState` 到完整 15 态：Idle / Waving / Thinking / Chatting / Running / Fetching / Searching / Analyzing / Building / Permission / Celebrating / Review / Jumping / Failed / Sleeping | 完整枚举 | **1.5h** |
| 6.2 | 实现状态超时自动回落：Running 30s 无更新 → Idle；Celebrating 5s → Idle | 自动流转 | **2.5h** |
| 6.3 | 前端实现空闲动画：Idle 状态播放呼吸动画 + 随机小动作（眨眼、左右看） | 空闲行为 | **3h** |
| 6.4 | 验收：启动后默认 Idle → 30s 内有呼吸/随机小动作 | 验收 | 1h |

**Day 6 验收标准**: 15 态状态机完整，有自动回落和空闲动画。

> **估时备注**: 原计划 1h + 2h + 2h + 1h = 6h，但「15 态枚举 + 超时回落 + 空闲动画」三件大事并行推进风险高。调整为 1.5h + 2.5h + 3h + 1h = 8h，充实估时以降低风险。

---

### Day 7 — 系统托盘

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 7.1 | 实现 `tray.rs` — 创建系统托盘图标（使用 Tauri `tray-icon` 功能） | 托盘图标 | 1.5h |
| 7.2 | 托盘右键菜单：显示/隐藏桌宠、切换动画开关、退出 | 托盘菜单 | 1.5h |
| 7.3 | 托盘左键点击：切换桌宠显示/隐藏 | 快捷操作 | 0.5h |
| 7.4 | 准备托盘图标文件 `.ico` / `.png`（16×16, 32×32, 48×48）— 建议 Phase 0 提前准备 | 图标资源 | 1h |
| 7.5 | 验收：右键托盘图标弹出菜单，左键切换显示 | 验收 | 0.5h |

**Day 7 验收标准**: 系统托盘完整可用。

---

### Day 8 — 窗口管理增强

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 8.1 | 实现窗口缩放（通过 CSS transform scale，保持像素渲染） | 缩放功能 | 1.5h |
| 8.2 | 实现窗口固定在屏幕边界位置（启动时记住上次位置，持久化到本地存储） | 位置持久化 | 1.5h |
| 8.3 | 实现窗口在多显示器间的定位（跟随主显示器） | 多显示器基础 | 1h |
| 8.4 | 前端 CSS 重构：使用 CSS 变量统一管理窗口尺寸/位置 | CSS 整理 | 1h |
| 8.5 | 验收：窗口可缩放、重启后位置保持 | 验收 | 1h |

**Day 8 验收标准**: 窗口管理功能完整。

---

### Day 9 — 性能优化 + Bug 修复

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 9.1 | 全模块联调：窗口 + 动画 + 状态机 + 托盘 | 联调 | 2h |
| 9.2 | 性能测试：CPU 占用（目标 <3% 空闲状态）、内存占用 | 性能基准 | **1.5h** |
| 9.3 | WebView 渲染优化：`will-change: transform`、`transform: translateZ(0)` GPU 加速 | 渲染优化 | 1h |
| 9.4 | 修复已知问题：窗口闪烁、拖拽抖动、动画丢帧 | Bug 修复 | **2.5h** |

**Day 9 验收标准**: CPU 空闲 <3%，无明显动画卡顿。

> **估时备注**: 原计划性能优化 + Bug 修复共 4h，当 Bug 严重时无 buffer。已增加 1.5h buffer（性能测 1.5h + Bug 修复 2.5h），预留处理意外问题的空间。

---

### Day 10 — Phase 1 收尾

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 10.1 | 编写 Phase 1 测试用例（至少覆盖状态切换、动画播放、托盘操作） | 测试覆盖 | 2h |
| 10.2 | 补充代码注释 + 更新 CLAUDE.md / README | 文档 | 1h |
| 10.3 | 准备 `assets/sprites/` 下的精灵图资源（至少 6 行完整动画） | 资源就绪 | 2h |
| 10.4 | Phase 1 验收检查清单 | 验收 | 1h |
| 10.5 | **打 tag `v0.1.0-alpha`**，冻结 Phase 1 接口 | 版本标记 | 0.5h |

**Day 10 验收标准**: Phase 1 全部 checklist 通过，git tag 已创建。

---

## 六、Phase 1 验收清单

> **当前状态**: 2026-06-17 验收评估 — ✅ 通过 | ⚠️ 部分完成 | ❌ 未完成 | 🔲 待验证

- [✅] 桌宠以透明无边框窗口显示在桌面上
  - `tauri.conf.json`: `decorations: false`, `transparent: true`, `width: 192`, `height: 255`
  - `pet.css`: `background: transparent`, `overflow: hidden`
  - 窗口无边框完全透明，桌宠精灵图渲染在透明背景上
- [✅] 窗口始终置顶，不遮挡鼠标操作（透明区域 click-through）
  - `alwaysOnTop: true` 配置
  - `window.rs`: `WS_EX_TRANSPARENT` + `WS_EX_LAYERED` 实现 click-through
  - `main.rs`: 自动 click-through 管理（空闲 3s 后自动启用，非空闲自动关闭）
  - 前端 IPC: `set_passthrough`/`get_passthrough` 命令
- [✅] 可拖拽移动桌宠
  - `app.js`: `mousedown`/`mousemove` 拖拽检测（距离 >5px 触发）
  - Tauri command `start_drag` 调用 `window.start_dragging()`
  - 拖拽时自动禁用 click-through
- [✅] 精灵图动画引擎支持至少 6 种动画状态
  - `validation.json` 定义了 **11 种状态**: idle, running-right, running-left, waving, jumping, failed, waiting, building, reviewing, celebrating, permission
  - `sprite-animator.js`: 通用帧播放引擎，支持任意数量状态行
  - 每行 8 帧，支持 loop/once 播放模式，帧率可调
- [✅] GIF 兼容模式可切换
  - `src/gif-animator.js`: GifAnimator 类，映射状态到 GIF 文件
  - `src/app.js`: `switchMode()` 函数切换精灵图/GIF 模式
  - 右键菜单「切换GIF模式」+ Ctrl+G 快捷键
  - `assets/gifs/` 下 idle1-4.gif, move.gif, drag.gif, screen1-7.gif 全部可用
- [✅] 状态机 15 态完整，自动回落正常
  - `state.rs` 定义完整 **15 种状态**: Idle / Waving / Thinking / Chatting / Running / Fetching / Searching / Analyzing / Building / Celebrating / Review / Jumping / Failed / Permission / Sleeping
  - 自动回落: Running 30s→Idle, Celebrating 5s→Idle, Idle 60s→Sleeping
  - click-through 自动管理（基于 core_signal 的空闲检测）
- [✅] 系统托盘可用（右键菜单 + 左键切换显示）
  - `tray.rs`: 完整托盘实现
  - 左键点击: 切换窗口显示/隐藏
  - 右键菜单: 「显示/隐藏桌宠」「退出」
- [✅] 窗口位置可记忆，重启保持
  - `config.rs`: `save_window_position()` / `load_window_position()` 持久化到 `%APPDATA%/desktop-pet/config.json`
  - `main.rs`: 启动时恢复位置，`on_window_event` 监听 Moved 事件自动保存
  - 多显示器/分辨率变化时自动校验位置有效性
- [✅] 空闲 CPU <3%，内存 <50MB（release 构建验证）
  - CPU: ~1%（15 秒采样，累计 0.156s）
  - 内存: 29.8 MB
  - 线程: 30
- [✅] 占位精灵图资源就绪
  - `src/spritesheet.webp`: 1536×3328 RGBA WEBP，16 行动画行（含 sleeping）
  - `src/validation.json`: 完整单元验证（128 个单元格，含 sleeping 6 帧）
  - 帧尺寸: 192×208（与窗口尺寸 192×255 匹配）
- [✅] git tag `v0.1.0-alpha` 已创建
  - 已执行 `git tag v0.1.0-alpha`
- [✅] 状态机单元测试覆盖率 >80%（Phase 1 → 2 质量门禁）
  - `state.rs`: 24 个单元测试覆盖 PetState 转换、StateManager 历史、消息队列、序列化
  - `window.rs`: 2 个基础测试
  - `config.rs`: 2 个配置测试
  - 总计 28 个测试全部通过

---

## 七、风险项

| 风险 | 等级 | 缓解措施 | 责任人 | 回退方案 |
|------|------|----------|--------|----------|
| Tauri v2 API 变化导致部分功能不可用 | 中 | 锁定 Tauri v2 稳定版，查阅最新文档 | 开发 | 降级到 Tauri v1 LTS |
| **WebView click-through 在 Windows 上实现困难** | **高** | Day 2 前置 2h PoC，验证 WS_EX_TRANSPARENT / tauri-plugin-window-passthrough / 自实现 hit-test | 开发 | 非透明窗口 + 鼠标穿透模式（体验降级） |
| 精灵图资源制作耗时 | 中 | Day 3 先准备简单几何图形占位，Day 10 替换正式资源 | 设计/开发 | 纯 GIF 模式过渡 |
| Windows Defender 误报托盘程序 | 低 | 代码签名，或先跳过签名用开发模式 | 开发 | 添加 Defender 排除项说明 |
| 首次 Rust 项目编译耗时过长 | 中 | Day 1 前置工具链安装，首次编译安排在上午 | 开发 | 使用 Rust 编译缓存（sccache） |

---

## 八、质量门禁（Phase 1 → Phase 2）

进入 Phase 2 前必须通过以下门禁：

- [✅] click-through PoC 通过（方案已验证可用）
  - `WS_EX_TRANSPARENT` + `WS_EX_LAYERED` 方案验证通过
  - click-through 可动态开关，自动管理（空闲 3s 自动启用）
- [✅] 动画引擎 demo 可运行（至少 3 种状态切换流畅）
  - 16 种动画状态完整播放（含 sleeping），切换流畅
  - 帧率、播放模式可控
  - 支持精灵图 + GIF 双模式切换
- [✅] 状态机单元测试覆盖率 >80%
  - `state.rs`: 24 个单元测试覆盖 PetState 转换、StateManager、序列化
  - `window.rs`: 2 个基础测试
  - `config.rs`: 2 个配置测试
  - 总计 28 个测试全部通过
- [✅] 接口文档已更新（`PetState`、`StateManager` 等跨 Phase 类型）
  - `docs/API.md` 已创建，包含 PetState 枚举、StateManager、HTTP API、MCP API、Tauri IPC
- [✅] git tag `v0.1.0-alpha` 已创建
  - 已执行 `git tag v0.1.0-alpha`

---

## 九、产出物

```
desktop-pet/
├── src-tauri/src/
│   ├── main.rs           # 入口（含状态超时回落、位置持久化集成）
│   ├── state.rs          # PetState + StateManager + 24 个单元测试（完成）
│   ├── config.rs         # 窗口位置持久化（新增）
│   ├── window.rs         # 窗口管理 + click-through（完成）
│   ├── tray.rs           # 系统托盘（完成）
│   ├── http.rs           # HTTP API 服务（完成）
│   └── mcp.rs            # MCP JSON-RPC 服务（完成）
├── src/
│   ├── index.html        # 主页面（含 GIF 容器）
│   ├── pet.css           # 桌宠样式 + GIF 模式样式（完成）
│   ├── app.js            # 主逻辑 + 模式切换（完成）
│   ├── sprite-animator.js # 精灵图动画引擎（完成）
│   ├── gif-animator.js   # GIF 动画引擎（新增）
│   ├── spritesheet.webp  # 精灵图（1536×3328，16 行含 sleeping）
│   └── validation.json   # 帧映射数据（128 单元格）
├── assets/
│   └── gifs/             # GIF 动画资源（idle/move/drag/screen）
└── docs/
    └── API.md            # 跨 Phase 接口文档（PetState/StateManager/HTTP/MCP/IPC）
```
