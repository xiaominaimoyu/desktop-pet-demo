# Desktop Pet — AI 编程伴侣桌宠

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

一只运行在桌面上的像素风宠物，能**实时感知 AI 编程工具的工作状态**，根据编码进度自动切换动画、弹出气泡提示。支持 Claude Code、opencode 等工具的 Hook/MCP 深度集成，也兼容任意终端工具的被动监控模式（本项目还只是半成品）。

## 快速开始

### 直接运行（Windows）

```bash
# 解压后双击运行
start-desktop-pet.bat

# 或直接启动
./desktop-pet.exe
```

### 浏览器预览 Demo

打开 `demo.html` 即可在浏览器中预览桌宠动画效果和交互。

## 核心能力

### 实时状态感知

桌宠通过三级适配策略感知 CLI 工具状态：

| 优先级 | 方式 | 延迟 | 适用工具 |
|--------|------|------|----------|
| Hook 模式 | CLI 工具主动推送事件到 HTTP API | <50ms | Claude Code, opencode |
| MCP 模式 | 双向 JSON-RPC 通信 | <100ms | Claude Code, opencode |
| 监控模式 | 文件/进程被动监控 | 1-5s | Vim, VS Code, 任意终端 |

### 15 态动画状态机

```
        ┌─ thinking（思考）
        ├─ chatting（对话）
running─┼─ running（执行中）
        ├─ fetching（获取网络）
        ├─ searching（搜索中）
        ├─ analyzing（分析中）
        └─ building（构建中）

waiting─┼─ idle（待机/呼吸）
        ├─ waving（挥手）
        └─ permission（等待确认）

ready ──┼─ celebrating（庆祝）
        ├─ review（审查中）
        └─ jumping（跳跃）

error ──┴─ failed（报错）
```

### 双动画引擎

- **Spritesheet 模式**：WebP 精灵图，帧精确控制，性能最佳
- **GIF 模式**：兼容 GIF 动画资源，`Ctrl+G` 一键切换

### 交互方式

| 操作 | 行为 |
|------|------|
| 左键拖拽 | 移动桌宠 |
| 左键点击 | 触发打招呼 |
| 右键 | 快捷菜单（发消息/切换适配器/休眠/退出） |
| 双击 | 切换运动模式（自由漫游 ↔ 编码跟随） |
| `Ctrl+G` | 切换 Spritesheet / GIF 模式 |

## MCP 工具集

桌宠提供 MCP Server，AI 编程工具可通过 JSON-RPC 主动操控桌宠：

| 工具 | 功能 |
|------|------|
| `pet_show` | 显示自定义气泡消息 |
| `pet_ask` | 向用户提问并等待回复 |
| `pet_play` | 强制播放指定动画 |
| `pet_get_user_input` | 阻塞等待用户输入（文本/确认/选择） |

## HTTP API

桌宠启动后在 `localhost:{port}` 上暴露 REST API：

```bash
# 触发思考状态
curl -X POST http://localhost:1420/api/state \
  -H "Content-Type: application/json" \
  -d '{"s": "thinking"}'

# 触发构建状态
curl -X POST http://localhost:1420/api/state \
  -H "Content-Type: application/json" \
  -d '{"s": "building", "tool": "Edit"}'

# 查询当前状态
curl http://localhost:1420/api/current
```

完整 API 文档见 [docs/API.md](docs/API.md)。

## 配置 Claude Code / opencode Hook

在对应工具的 hook 配置中添加 HTTP 回调：

```json
{
  "hooks": {
    "onSessionStart": "curl -s http://127.0.0.1:9527/api/hook/session-start",
    "onPromptSubmit": "curl -s http://127.0.0.1:9527/api/hook/thinking",
    "onToolCall": "curl -s -X POST http://127.0.0.1:9527/api/hook/working",
    "onToolComplete": "curl -s http://127.0.0.1:9527/api/hook/done",
    "onIdle": "curl -s http://127.0.0.1:9527/api/hook/idle"
  }
}
```

详细配置模板见 [docs/hooks-copilot.json](docs/hooks-copilot.json) 和 [docs/hooks-opencode.json](docs/hooks-opencode.json)。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 框架 | Tauri v2 (Rust + WebView) | 跨平台桌面框架，透明无边框窗口 |
| 后端 | Rust + Tokio + Axum | 异步运行时 + HTTP/MCP 服务 |
| 前端 | HTML/CSS/JS (WebView) | 精灵动画 + CSS 过渡 + 气泡系统 |
| 动画 | Spritesheet WebP + GIF | 双模式，性能与兼容兼顾 |
| 协议 | MCP (JSON-RPC 2.0) | AI 工具双向通信 |

## 项目结构

```
desktop-pet-demo/
├── src/                  # 前端 WebView 源码
│   ├── index.html        # 主页面（透明窗口）
│   ├── app.js            # 主逻辑：事件监听、状态机、交互
│   ├── sprite-animator.js # Spritesheet 动画引擎
│   ├── gif-animator.js   # GIF 动画引擎
│   ├── bubble.js         # 气泡系统
│   ├── pet.css           # 桌宠样式
│   ├── spritesheet.webp  # 精灵图资源
│   └── validation.json   # 帧映射数据
├── docs/                 # 文档
│   ├── API.md            # HTTP/MCP API 完整文档
│   ├── PROPOSAL.md       # 项目方案（架构/路线图）
│   ├── hooks-*.json      # CLI 工具 hook 配置模板
│   ├── architecture/     # 架构文档
│   └── tech-research/    # 技术调研
├── demo.html             # 在线演示页面
├── desktop-pet.exe       # 编译好的 Windows 可执行文件
└── start-desktop-pet.bat # Windows 启动脚本
```

## 设计理念

- **非侵入**：桌宠不拦截快捷键，不修改系统配置，静默运行
- **渐进增强**：有 Hook 用 Hook，没 Hook 用 MCP，都没有就降级到文件/进程监控
- **像素美学**：`image-rendering: pixelated`，致敬经典桌面宠物
- **可扩展**：适配器模式，添加新 CLI 工具只需实现 trait

## License

MIT

---

## 参考项目

本项目参考了以下开源项目：

- [aemeath_withclaude](https://github.com/77wliNd/aemeath_withclaude) — Tauri/Rust 桌宠，Claude Code Hook 集成
- [ameath](https://gitee.com/lzy-buaa-jdi/ameath) — Python/Tkinter 桌宠，丰富的动画与交互
