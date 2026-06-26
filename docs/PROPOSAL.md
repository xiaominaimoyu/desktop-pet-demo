# 桌面宠物方案 — 适配 CLI 编码状态

## 一、项目定位

参考 **ameath**（Python/Tkinter 桌宠，丰富的动画与交互）和 **aemeath_withclaude**（Tauri/Rust 桌宠，Claude Code 钩子集成），打造一款**通用 CLI 编码状态感知桌宠**：

- 桌宠能**实时感知** opencode / Claude Code / 任意 CLI 工具的编码状态
- 根据状态切换动画、气泡提示、音效
- 保留 ameath 的**自由移动、鼠标跟随、拖拽交互**等核心体验
- 保留 aemeath 的**状态映射与钩子机制**，并扩展为通用适配层

---

## 二、技术选型

| 层 | 技术 | 理由 |
|---|---|---|
| **框架** | Tauri v2 (Rust + WebView) | 跨平台、轻量、原生窗口控制强、可内嵌 HTTP/MCP 服务 |
| **后端** | Rust + Tokio | 高性能异步、与 Tauri 天然集成、可运行 HTTP/MCP/文件监控服务 |
| **前端** | HTML/CSS/JS (WebView) | 灵活的精灵动画、CSS 过渡、易于定制皮肤 |
| **动画** | CSS Spritesheet + GIF 双模式 | 精灵图模式性能好（aemeath 方案），GIF 模式兼容 ameath 资源 |
| **打包** | Tauri bundler | 单一可执行文件，自动更新 |

> **为什么选 Tauri 而不是 Python/Tkinter？**
> - Tauri 窗口透明、置顶、无边框等原生能力更强
> - Rust 后端可直接启动 HTTP/MCP 服务，无需额外进程
> - WebView 渲染动画比 Tkinter Canvas 更流畅
> - 跨平台（Windows/macOS/Linux）支持更好
> - 包体更小（~5MB vs PyInstaller ~50MB+）

---

## 三、核心架构

```
┌─────────────────────────────────────────────────────┐
│                    Desktop Pet App                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │  WebView  │  │  Rust     │  │  CLI Adapter      │ │
│  │  (前端)   │◄─┤  Backend  │◄─┤  (状态感知层)     │ │
│  │          │  │          │  │                   │ │
│  │ · 动画   │  │ · 窗口   │  │ · opencode 适配  │ │
│  │ · 气泡   │  │ · 拖拽   │  │ · Claude Code 适配│ │
│  │ · 菜单   │  │ · 音效   │  │ · 通用终端适配    │ │
│  │ · 设置   │  │ · HTTP   │  │ · 文件监控适配    │ │
│  └──────────┘  │ · MCP    │  └───────────────────┘ │
│                └──────────┘                         │
└─────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    Tauri Events   HTTP :9527    MCP :9528
         │              │              │
         │         ┌────┴────┐         │
         │         │ CLI 工具 │         │
         │         │ (hooks) │         │
         │         └─────────┘         │
         │                              │
    ┌────┴──────────────────────────────┴────┐
    │           文件系统 / 进程监控            │
    │  (无 hook 时的降级方案)                  │
    └────────────────────────────────────────┘
```

---

## 四、CLI 状态感知层（核心创新）

### 4.1 三级适配策略

| 优先级 | 方式 | 适用场景 | 延迟 |
|--------|------|----------|------|
| **1. Hook 模式** | CLI 工具主动推送事件 | opencode、Claude Code 等支持 hook 的工具 | <50ms |
| **2. MCP 模式** | 双向 JSON-RPC 通信 | opencode、Claude Code 等支持 MCP 的工具 | <100ms |
| **3. 监控模式** | 被动监控文件/进程 | 任意 CLI 工具（无侵入） | 1-5s |

### 4.2 Hook 模式 — opencode 适配

opencode 支持 hook 配置（类似 Claude Code 的 `settings.json`），在关键事件触发时 POST 到本地服务：

```json
// ~/.config/opencode/opencode.json — hook 配置示例
{
  "hooks": {
    "onSessionStart": "curl -s http://127.0.0.1:9527/api/hook/session-start",
    "onPromptSubmit": "curl -s http://127.0.0.1:9527/api/hook/thinking",
    "onToolCall": "curl -s -X POST http://127.0.0.1:9527/api/hook/working -d '{tool}'",
    "onToolComplete": "curl -s http://127.0.0.1:9527/api/hook/done",
    "onIdle": "curl -s http://127.0.0.1:9527/api/hook/idle",
    "onPermissionRequest": "curl -s http://127.0.0.1:9527/api/hook/permission"
  }
}
```

**opencode 特有事件映射：**

| opencode 事件 | 桌宠状态 | 气泡文本 |
|---------------|---------|---------|
| `onSessionStart` | Waving | 桌宠已上线~ |
| `onPromptSubmit` | Chatting | 正在思考... |
| `onToolCall(read/grep/glob)` | Running | 正在读取文件... |
| `onToolCall(write/edit)` | Building | 正在编写代码... |
| `onToolCall(bash)` | Running | 正在执行命令... |
| `onToolCall(webfetch/websearch)` | Searching | 正在搜索... |
| `onToolCall(task/subtask)` | Analyzing | 正在分析... |
| `onToolComplete` | Celebrating | 搞定! |
| `onIdle` | Idle | — |
| `onPermissionRequest` | Permission | 等待确认... |
| `onError` | Failed | 出问题了... |

### 4.3 MCP 模式 — 双向通信

与 aemeath_withclaude 相同的 MCP 服务，让 opencode 可以主动与桌宠交互：

| MCP Tool | 功能 |
|----------|------|
| `pet_show` | 显示自定义气泡消息 |
| `pet_ask` | 非阻塞提问 |
| `pet_play` | 强制播放指定动画 |
| `pet_get_input` | 阻塞等待用户输入（文本/确认/选择） |

### 4.4 监控模式 — 通用 CLI 适配（降级方案）

当 CLI 工具不支持 hook 时，通过被动监控推断编码状态：

```rust
// 文件监控器 — 检测项目文件变更
struct FileWatcher {
    watched_dirs: Vec<PathBuf>,    // 监控的项目目录
    debounce: Duration,            // 防抖间隔 (500ms)
}

// 进程监控器 — 检测终端进程活动
struct ProcessWatcher {
    terminal_names: Vec<String>,  // ["cmd.exe", "powershell.exe", "bash", "node"]
    poll_interval: Duration,      // 轮询间隔 (2s)
}
```

**推断逻辑：**

| 监控信号 | 推断状态 | 气泡 |
|---------|---------|------|
| 文件频繁写入 | Building | 正在编码... |
| 文件读取但无写入 | Running | 正在查看代码... |
| 终端进程活跃 | Running | 正在执行... |
| 长时间无变更 | Idle | — |
| 编译输出有 error | Failed | 编译出错了... |
| 编译输出有 success | Celebrating | 编译成功! |

---

## 五、动画系统设计

### 5.1 状态机（15 态 → 3 核心信号 + 细分）

参考 aemeath 的 REDESIGN.md 简化思路，采用**三层状态**：

```
核心信号 (3)          细分状态 (15)           动画
─────────────        ─────────────           ──────
running ───────────► thinking               思考/挠头
                    chatting                说话气泡
                    running                 跑动
                    fetching                跑动+搜索图标
                    searching               跑动+放大镜
                    analyzing               跑动+齿轮
                    building               跑动+锤子

waiting ───────────► idle                   站立/呼吸
                    waving                  挥手
                    permission              挥手+问号

ready ─────────────► celebrating            跳跃+星星
                    review                  点头+对勾
                    jumping                跳跃

error ─────────────► failed                 晕眩/冒烟
```

### 5.2 动画资源方案

**双模式兼容：**

| 模式 | 来源 | 格式 | 优势 |
|------|------|------|------|
| Spritesheet | 新制作 | WebP 精灵图 | 性能好、帧精确控制 |
| GIF | 复用 ameath | 多个 GIF 文件 | 兼容现有资源、快速启动 |

**精灵图规格（推荐）：**
- 单帧尺寸：192×208px（与 aemeath 一致）
- 列数：8（每行动画帧数）
- 行数：15（对应 15 个状态）
- 总尺寸：1536×3120px
- 帧率：~180ms/帧
- 渲染：`image-rendering: pixelated` 保持像素风

### 5.3 移动系统（继承 ameath）

| 行为 | 触发条件 | 参数 |
|------|---------|------|
| **漫游** | 默认状态 | 随机目标点，惯性移动 |
| **鼠标跟随** | 鼠标距离 >200px | 速度 2px/帧 |
| **好奇观察** | 鼠标距离 <60px | 停下看鼠标 |
| **随机休息** | 概率触发 | 持续 3-8 秒 |
| **编码跟随** | CLI 状态变化 | 跑到屏幕中央区域 |

**物理参数（继承 ameath）：**
- 惯性系数：0.95
- 意图系数：0.05
- 抖动：每 5 帧随机微移
- 边界处理：反弹或瞬移

---

## 六、交互设计

### 6.1 鼠标交互

| 操作 | 行为 |
|------|------|
| 左键拖拽 | 移动桌宠窗口 |
| 左键点击 | 触发打招呼动画 |
| 右键点击 | 弹出快捷菜单 |
| 双击 | 切换编码模式/自由模式 |

### 6.2 快捷菜单

```
┌─────────────────┐
│ 📊 编码状态      │  ← 显示当前 CLI 状态
│ ─────────────── │
│ 💬 发消息给 CLI  │  ← 向终端发送文本
│ 😴 休眠          │  ← 暂停动画
│ 🔔 通知模式      │  ← 仅在有事件时弹出
│ ─────────────── │
│ ⚙️ 设置          │
│ ❓ 关于          │
│ ❌ 退出          │
└─────────────────┘
```

### 6.3 气泡系统

- **状态气泡**：自动显示当前编码状态（带 800ms 防抖，避免闪烁）
- **消息气泡**：CLI 工具通过 MCP 发送的自定义消息
- **输入气泡**：CLI 工具请求用户输入时弹出（文本框/确认/选择）

---

## 七、项目结构

```
desktop-pet/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   └── src/
│       ├── main.rs              # 入口：启动 HTTP/MCP/Tauri
│       ├── state.rs             # PetState 枚举 + StateManager
│       ├── http.rs              # Axum HTTP 路由 (hook 接收 + 前端轮询)
│       ├── mcp.rs               # MCP JSON-RPC 服务
│       ├── tray.rs              # 系统托盘
│       ├── adapter/             # ★ CLI 适配层
│       │   ├── mod.rs           # 适配器 trait 定义
│       │   ├── opencode.rs      # opencode 适配器
│       │   ├── claude_code.rs   # Claude Code 适配器
│       │   └── generic.rs       # 通用终端适配器 (文件/进程监控)
│       ├── monitor/             # ★ 监控模块
│       │   ├── file_watcher.rs  # 文件变更监控
│       │   ├── process_watcher.rs # 进程活动监控
│       │   └── terminal.rs      # 终端输出解析
│       └── window.rs            # 窗口管理 (置顶/透明/拖拽)
├── src/
│   ├── index.html               # 主页面
│   ├── pet.css                  # 桌宠样式
│   ├── app.js                   # 主逻辑：Tauri 事件 + 轮询
│   ├── sprite-animator.js       # 精灵图动画引擎
│   ├── movement.js              # 移动系统 (漫游/跟随/物理)
│   ├── bubble.js                # 气泡系统
│   └── menu.js                  # 右键菜单
├── assets/
│   ├── sprites/                 # 精灵图资源
│   │   ├── spritesheet.webp     # 主精灵图
│   │   └── validation.json      # 帧映射数据
│   ├── gifs/                    # GIF 资源 (兼容模式)
│   ├── sounds/                  # 音效
│   │   ├── voice/               # 交互音效
│   │   └── music/               # 背景音乐
│   └── fonts/                   # 像素字体
├── docs/
│   ├── API.md                   # HTTP/MCP API 文档
│   ├── hooks-opencode.json      # opencode hook 配置模板
│   ├── hooks-claude.json         # Claude Code hook 配置模板
│   └── ADAPTER.md               # 适配器开发指南
├── CLAUDE.md                    # 项目说明
└── package.json
```

---

## 八、CLI 适配器 Trait 设计

```rust
/// CLI 适配器 trait — 所有 CLI 工具的统一接口
#[async_trait]
pub trait CliAdapter: Send + Sync {
    /// 适配器名称
    fn name(&self) -> &str;

    /// 检测该 CLI 工具是否正在运行
    async fn is_running(&self) -> bool;

    /// 启动监听（注册 hook / 启动监控）
    async fn start(&self, state: Arc<StateManager>) -> Result<()>;

    /// 停止监听
    async fn stop(&self) -> Result<()>;

    /// 获取当前 CLI 状态（用于轮询降级）
    async fn current_state(&self) -> Option<PetState>;
}

/// CLI 事件 — 所有适配器统一的事件格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliEvent {
    pub source: String,        // "opencode" | "claude-code" | "generic"
    pub event_type: EventType, // 事件类型
    pub tool_name: Option<String>,  // 工具名（如 "bash", "write"）
    pub detail: Option<String>,     // 附加信息
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    SessionStart,
    PromptSubmit,
    ToolCall,
    ToolComplete,
    Idle,
    PermissionRequest,
    Error,
}
```

---

## 九、开发路线图

### Phase 1 — 基础框架（1-2 周）
- [ ] Tauri v2 项目搭建
- [ ] 透明无边框窗口 + 置顶 + 拖拽
- [ ] 精灵图动画引擎（复用 aemeath 的 sprite-animator.js）
- [ ] 基础状态机（Idle / Running / Celebrating）
- [ ] 系统托盘

### Phase 2 — CLI 集成（1-2 周）
- [ ] Axum HTTP 服务（hook 接收端点）
- [ ] opencode 适配器（hook 配置 + 事件映射）
- [ ] Claude Code 适配器（复用 aemeath 的 hook 端点）
- [ ] 气泡系统（状态气泡 + 防抖）
- [ ] MCP 服务基础

### Phase 3 — 交互增强（1-2 周）
- [ ] 移动系统（漫游 + 鼠标跟随 + 物理引擎）
- [ ] 右键菜单
- [ ] 音效系统
- [ ] MCP 双向通信（pet_show / pet_ask / pet_get_input）
- [ ] 用户消息转发到 CLI

### Phase 4 — 通用适配（1 周）
- [ ] 文件监控适配器（监控项目目录变更）
- [ ] 进程监控适配器（检测终端活动）
- [ ] 终端输出解析（检测编译错误等）
- [ ] 适配器自动发现与切换

### Phase 5 — 打磨发布（1 周）
- [ ] 设置面板（缩放/透明度/显示模式/适配器选择）
- [ ] 多显示器支持
- [ ] 自动更新
- [ ] 打包与发布

---

## 十、与参考项目的对比

| 特性 | ameath | aemeath_withclaude | 本方案 |
|------|--------|--------------------|--------|
| 技术栈 | Python/Tkinter | Tauri/Rust+JS | **Tauri/Rust+JS** |
| CLI 集成 | ❌ | Claude Code only | **opencode + Claude Code + 通用** |
| Hook 模式 | ❌ | ✅ HTTP hooks | **✅ HTTP hooks** |
| MCP 模式 | ❌ | ✅ | **✅** |
| 文件/进程监控 | ❌ | ❌ | **✅ (降级方案)** |
| 自由移动 | ✅ 漫游/跟随 | ❌ 固定位置 | **✅ 漫游/跟随/编码跟随** |
| 鼠标交互 | ✅ 拖拽/跟随 | ✅ 拖拽/右键 | **✅ 拖拽/跟随/右键/双击** |
| 音效 | ✅ 语音+音乐 | ❌ | **✅ 交互音效** |
| 气泡系统 | ❌ | ✅ 状态+输入 | **✅ 状态+消息+输入** |
| 跨平台 | ❌ Windows only | ❌ Windows only | **✅ Win/Mac/Linux** |
| 包体大小 | ~50MB | ~10MB | **~5-8MB** |

---

## 十一、关键设计决策

### 11.1 为什么用适配器模式？

不同 CLI 工具的事件模型不同：
- **opencode**：通过 `opencode.json` 配置 hooks，事件类型与 Claude Code 类似但名称不同
- **Claude Code**：通过 `settings.json` 配置 hooks，有 `PreToolUse/PostToolUse` 等事件
- **通用终端**：没有 hook 机制，只能通过文件/进程监控推断

适配器模式让每种 CLI 工具有独立的实现，但对外统一输出 `CliEvent`，桌宠核心逻辑无需关心具体 CLI。

### 11.2 为什么保留监控模式？

不是所有 CLI 都支持 hook。监控模式让桌宠在**任何编码场景**下都能工作：
- 用 Vim 写代码 → 文件监控检测到保存 → Building 状态
- 跑测试 → 进程监控检测到 node/pytest → Running 状态
- 编译失败 → 终端输出解析 → Failed 状态

### 11.3 编码跟随移动

当 CLI 状态变化时，桌宠从当前位置**跑向屏幕中央区域**，让用户注意到状态变化。这是 ameath 没有但很有价值的功能——编码时桌宠不应躲在角落。

---

## 十二、opencode 集成配置示例

### 启动桌宠（opencode hook 自动拉起）

```json
// ~/.config/opencode/opencode.json
{
  "hooks": {
    "onSessionStart": "curl -s http://127.0.0.1:9527/api/hook/session-start",
    "onPromptSubmit": "curl -s -X POST http://127.0.0.1:9527/api/hook/thinking -H 'Content-Type: application/json' -d '{}'",
    "onToolCall": "curl -s -X POST http://127.0.0.1:9527/api/hook/working -H 'Content-Type: application/json' -d '{\"tool\": \"$TOOL_NAME\"}'",
    "onToolComplete": "curl -s http://127.0.0.1:9527/api/hook/done",
    "onIdle": "curl -s http://127.0.0.1:9527/api/hook/idle",
    "onPermissionRequest": "curl -s http://127.0.0.1:9527/api/hook/permission"
  }
}
```

### MCP 配置

```json
// ~/.config/opencode/mcp.json
{
  "desktop-pet": {
    "type": "http",
    "url": "http://127.0.0.1:9528/mcp"
  }
}
```

---

*方案版本: v0.1 | 基于 ameath-master + aemeath_withclaude-main 分析*