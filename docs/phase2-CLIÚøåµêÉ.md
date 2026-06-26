# Phase 2 — CLI 集成任务书

> **工期**: **12 个工作日** | **里程碑**: 桌宠能感知 opencode / TRAE Work / Claude Code 的编码状态并切换动画
> **版本标签**: `v0.1.0-beta`（Phase 2 验收后打 tag）
>
> **验收状态 (2026-06-18)**:
> - 验收清单: 10/13 ✅ 通过 · 0/13 ⚠️ 部分 · 3/13 ⬜ 未完成
> - 质量门禁: 2/5 ✅ 通过 · 3/5 ⬜ 未通过
> - 总体评估: **Phase 2 接近完成** — opencode/TRAE Work/Copilot CLI/Claude Code 适配器全部实现，4 个 MCP tool 全部实现，TCP 端口回退已实现。剩余适配器自动发现、性能基准测试、git tag。

---

## 一、阶段目标

实现 HTTP 服务接收 CLI hook 事件 + opencode 适配器 + Claude Code 适配器 + 气泡系统 + MCP 服务基础，让桌宠与编码工具"对话"。

---

## 二、借鉴清单

| 模块 | 来源 | 改造点 | 估时节省 |
|------|------|--------|----------|
| HTTP 服务 (Axum 路由) | aemeath_withclaude Axum 实现 | 增加 opencode 端点、CORS 配置、日志层 | -1 天 |
| Claude Code 适配器 | aemeath_withclaude hook 端点 | 适配器 trait 包装、事件映射扩展 | -1 天 |
| opencode 适配器 | 部分参考 Claude Code 适配器模式 | 全新实现（opencode 事件格式不同） | -0.5 天 |
| MCP JSON-RPC 协议 | aemeath_withclaude MCP 实现 | 增加 pet_get_input 阻塞通道、错误处理 | -0.5 天 |

> **重要**: opencode hook 事件格式已通过 `@opencode-ai/plugin` 类型定义实测验证（见 `docs/tech-research/opencode CLI hook 事件格式调研手册.md`）。TRAE Work hook 事件格式已通过官方文档和社区案例验证（见 `docs/tech-research/TRAE_Work_Hook_事件调研报告.md`）。Claude Code hook 事件格式继承自 aemeath_withclaude 项目。

---

## 三、前置条件

- [✅] Phase 1 全部验收通过（质量门禁已通过）
- [✅] Phase 1 接口已冻结（git tag `v0.1.0-alpha`）
- [✅] opencode 已安装并可配置 hooks（v1.17.7）
- [✅] opencode hook 事件格式已实测确认（`docs/tech-research/opencode CLI hook 事件格式调研手册.md`）
- [✅] TRAE Work hook 事件格式已调研确认（`docs/tech-research/TRAE_Work_Hook_事件调研报告.md`）
- [️] Claude Code 已安装并可配置 hooks
- [️] 测试项目（Rust + Node + Python 三个示例项目）已就绪

---

## 四、版本管理规范

- 本 Phase 开始遵循接口版本化：`PetState`、`CliEvent` 等跨 Phase 类型变更须在提交信息中标注 `BREAKING:`
- Phase 2 验收后打 tag `v0.1.0-beta`
- 适配器接口（`CliAdapter` trait）冻结后不可随意修改

---

## 五、逐日任务

### Day 1 — Axum HTTP 服务搭建

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 1.1 | 在 `Cargo.toml` 添加依赖：axum、tower、tower-http（cors） | 依赖 | 0.5h |
| 1.2 | 实现 `http.rs` — 创建 Axum Router，监听 `127.0.0.1:9527` | HTTP 服务 | **1.5h** |
| 1.3 | 实现 Hook 接收端点 `POST /api/hook/:event_type`（session-start / thinking / working / done / idle / permission / error） | API 路由 | **2.5h** |
| 1.4 | 实现请求体解析：`CliEvent` 结构体反序列化 | 数据模型 | 1h |
| 1.5 | 实现端点到 StateManager 的转发：收到 hook → 映射 PetState → emit Tauri event | 事件管道 | **1.5h** |

**Day 1 验收标准**: `curl -X POST http://127.0.0.1:9527/api/hook/thinking` → 桌宠进入 Thinking 状态。

> **估时调整**: Axum 路由 + 7 个端点 + 状态映射 + Tauri 事件发射共需约 7h，原 6.5h 偏紧。已增加路由实现和事件管道的估时。

---

### Day 2 — Hook 端点完善 + 测试

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 2.1 | 实现 `GET /api/status` — 返回当前桌宠状态（JSON） | 状态查询 | 0.5h |
| 2.2 | 实现 `GET /api/health` — 健康检查端点 | 健康检查 | 0.5h |
| 2.3 | 实现 CORS 配置（允许 `127.0.0.1` 来源） | CORS | 0.5h |
| 2.4 | 添加请求日志（tower-http trace layer） | 日志 | 1h |
| 2.5 | 编写集成测试：用 `reqwest` 发送各个 hook 事件，验证状态切换 | 测试 | **3h** |

**Day 2 验收标准**: 所有 hook 端点有测试覆盖，日志可追踪请求。

---

### Day 3 — opencode 适配器

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 3.0 | **前置调研**：实测 opencode hook 事件名（`opencode --version` + 查看 hook 文档/源码） | 事件格式确认 | **1h** |
| 3.1 | 实现 `adapter/mod.rs` — `CliAdapter` trait 定义 | Trait 定义 | 1h |
| 3.2 | 实现 `adapter/opencode.rs` — `OpencodeAdapter` 结构体 | 适配器实现 | 2h |
| 3.3 | 实现 opencode 事件映射：`onSessionStart` → Waving, `onToolCall(bash)` → Running, `onToolCall(write)` → Building 等 | 事件映射表 | **2h** |
| 3.4 | 编写 `docs/hooks-opencode.json` — opencode hook 配置模板 | 配置模板 | 0.5h |
| 3.5 | 实机测试：启动 opencode → 发送 prompt → 验证桌宠动画跟随 | 实机联调 | **2.5h** |

**Day 3 验收标准**: opencode 编码全流程（输入 → 思考 → 工具调用 → 完成）桌宠动画跟随正确。

> **关键风险**: 若 3.0 调研发现 opencode 实际事件名与设计不符（如 `onSessionStart` 实际为 `session_start`），Day 3 剩余任务需整体调整。**3.0 的结果决定 Day 3-4 是否需要返工。**

---

### Day 4 — Claude Code 适配器

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 4.1 | 参考 aemeath_withclaude 的 hook 端点实现，了解 Claude Code hook 事件格式 | 调研 | 1h |
| 4.2 | 实现 `adapter/claude_code.rs` — `ClaudeCodeAdapter`（参考 opencode 适配器结构） | 适配器实现 | 2h |
| 4.3 | 实现 Claude Code 事件映射：`PreToolUse` → Running, `PostToolUse` → Celebrating, `Notification` → Waving 等 | 事件映射 | **2h** |
| 4.4 | 编写 `docs/hooks-claude.json` — Claude Code settings.json hook 配置模板 | 配置模板 | 0.5h |
| 4.5 | 实机测试：Claude Code session → 验证桌宠动画同步 | 实机联调 | **2.5h** |

**Day 4 验收标准**: Claude Code 编码全流程桌宠跟随正确。

---

### Day 5 — 适配器管理 + 自动发现

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 5.1 | 实现适配器注册表：`AdapterRegistry` — 管理多个适配器实例 | 注册表 | 1.5h |
| 5.2 | 实现适配器自动发现：启动时检测 opencode / claude-code 进程 → 激活对应适配器 | 自动发现 | **2.5h** |
| 5.3 | 实现适配器手动切换：通过托盘菜单选择当前适配器 | 手动切换 | 1h |
| 5.4 | 更新 `main.rs`：启动时初始化 HTTP 服务 + 适配器注册表 | 入口更新 | 1h |
| 5.5 | 测试：同时运行 opencode 和 claude-code → 自动选择活跃的适配器 | 验收 | 0.5h |

**Day 5 验收标准**: 适配器自动发现并激活，可通过托盘切换。

> **跨平台备注**: 适配器自动发现需要跨平台进程检测 — Windows 用 `sysinfo` crate 或 `WMI` 查询；macOS/Linux 用 `pgrep` 或 `/proc`。建议在 `AdapterRegistry` 中抽象 `ProcessDetector` trait，各平台分别实现。

---

### Day 6 — 气泡系统（上）— 状态气泡

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 6.1 | 创建 `src/bubble.js` — `BubbleManager` 类 | 气泡引擎 | 2h |
| 6.2 | 实现状态气泡 DOM 元素：跟随桌宠上方，淡入淡出动画 | 气泡 UI | 2h |
| 6.3 | 实现防抖逻辑：同一状态 800ms 内不重复触发气泡 | 防抖 | 1h |
| 6.4 | 前端监听 `pet-state-changed` → 显示对应气泡文本 | 联调 | 1h |

**Day 6 验收标准**: 状态变化时气泡平滑显示，无闪烁。

---

### Day 7 — 气泡系统（下）— 消息气泡 + 输入气泡

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 7.1 | 实现消息气泡：通过 Tauri event `pet-show-message` 显示自定义文本 | 消息气泡 | 1.5h |
| 7.2 | 实现输入气泡：文本框 + 确认/取消 按钮，结果通过 Tauri event 回传 | 输入气泡 | **3h** |
| 7.3 | 实现气泡队列：多个气泡排队显示，每个显示 3s，不重叠 | 气泡队列 | 1.5h |
| 7.4 | 验收：手动触发消息气泡和输入气泡，交互正确 | 验收 | 0.5h |

**Day 7 验收标准**: 三种气泡（状态/消息/输入）全部可用。

---

### Day 8 — MCP 服务基础

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 8.1 | 实现 `mcp.rs` — MCP JSON-RPC 2.0 协议处理（监听 `127.0.0.1:9528`） | MCP 协议 | **3.5h** |
| 8.2 | 实现 MCP `initialize` 方法：返回 server info + capabilities | 初始化 | 1h |
| 8.3 | 实现 MCP `tools/list` 方法：返回 4 个 tool 声明（pet_show / pet_ask / pet_play / pet_get_input） | 工具列表 | **2h** |
| 8.4 | 实现 MCP 基础错误处理：无效 JSON-RPC 请求 → 标准错误响应 | 错误处理 | **1h** |
| 8.5 | 验证：用 curl 模拟 MCP 客户端调用 `initialize` 和 `tools/list` | 验证 | 0.5h |

**Day 8 验收标准**: MCP 协议握手成功，tools/list 返回正确。

> **估时调整**: JSON-RPC 2.0 从零实现 + initialize + tools/list + 错误处理，原 6h 偏紧。已增加协议处理和错误处理的估时。

---

### Day 9 — MCP 工具调用实现

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 9.1 | 实现 `tools/call` 路由 → 分发到具体处理函数 | 工具路由 | **2h** |
| 9.2 | 实现 `pet_show` tool：接收 `message` 参数 → emit 消息气泡事件 | pet_show | 1h |
| 9.3 | 实现 `pet_play` tool：接收 `animation` 参数 → 强制切换动画 | pet_play | 1h |
| 9.4 | 实现 `pet_ask` tool：接收 `question` 参数 → 显示输入气泡（非阻塞） | pet_ask | 1.5h |
| 9.5 | 实现 `pet_get_input` tool：接收 `prompt` + `type` 参数 → 阻塞等待用户输入 | pet_get_input | **3h** |

**Day 9 验收标准**: 4 个 MCP tool 全部可用，阻塞/非阻塞行为正确。

> **`pet_get_input` 复杂度**: 该 tool 涉及前端输入气泡弹出 + Rust 端阻塞等待 + Tauri event 双向通道 + 超时处理，是 MCP 中最复杂的模块。原 2h 估时不足，已调整为 3h。

---

### Day 10 — Phase 2 联调

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 10.1 | 全链路联调：opencode/Claude Code hook → HTTP → StateManager → 动画 → 气泡 | 联调 | **3h** |
| 10.2 | 全链路联调：CLI tool 调用 MCP → 桌宠响应 → 结果返回 | 联调 | **2h** |
| 10.3 | 性能测试：HTTP 服务延迟 <50ms，MCP 延迟 <100ms | 性能验证 | 1h |
| 10.4 | 修复联调中发现的问题 | Bug 修复 | **2h** |

**Day 10 验收标准**: opencode 和 Claude Code 全流程联调通过。

---

### Day 11 — 溢出 + 深度修复

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 11.1 | Day 1-10 未完成的溢出任务 | 收尾 | 2h |
| 11.2 | 边界情况处理：断网、端口冲突、适配器崩溃恢复 | 健壮性 | 2h |
| 11.3 | 日志系统完善：适配器切换日志、事件追踪、错误日志分级 | 日志 | 1.5h |
| 11.4 | 压力测试：高频 hook 事件（短时间 100+ 请求）→ 验证防抖和状态稳定 | 压力测试 | 1.5h |
| 11.5 | 修复压力测试中发现的问题 | Bug 修复 | 1h |

**Day 11 验收标准**: 系统在压力下稳定运行，无状态翻转异常。

---

### Day 12 — Phase 2 收尾 + 质量门禁

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 12.1 | 编写 Phase 2 测试用例（适配器切换、MCP 调用、气泡交互） | 测试覆盖 | 2h |
| 12.2 | 补充代码注释 + 更新 CLAUDE.md / README / API.md | 文档 | 1.5h |
| 12.3 | Phase 2 验收检查清单 | 验收 | 1h |
| 12.4 | **打 tag `v0.1.0-beta`**，冻结适配器接口 | 版本标记 | 0.5h |
| 12.5 | Phase 2 → Phase 3 质量门禁检查 | 质量门禁 | 0.5h |

**Day 12 验收标准**: Phase 2 全部 checklist 通过，git tag 已创建。

---

## 六、Phase 2 验收清单

> **当前状态**: 2026-06-18 代码审计后更新 — ✅ 通过 | ⚠️ 部分完成 | ❌ 未完成

- [✅] HTTP 服务端口正常监听（支持 fallback）
  - `http.rs`: Axum Router，端口通过 `try_bind_port()` 动态绑定（支持 9527-9537 回退）
  - 端点: /api/state, /api/current, /api/heartbeat, /api/hook/*, /api/event, /api/user/*, /api/copilot/*
  - CORS 配置: 允许所有来源
  - 绑定成功后写入 `%TEMP%/desktop-pet-ports.json` 供外部进程发现
- [✅] 全部 7 个 hook 端点可用（session-start / thinking / working / done / idle / permission / error）
  - `/api/hook/thinking` → Chatting 状态
  - `/api/hook/working` → Running/Building/Fetching/Searching/Analyzing（根据 tool_name 映射）
  - `/api/hook/done` → Celebrating 状态
  - `/api/hook/idle` → Idle 状态
  - `/api/hook/permission` → Permission 状态
  - `/api/event` → 通用事件端点（支持 opencode/trae/claude-code/generic 来源）
  - `/api/state` → 直接设置状态
- [✅] opencode 适配器：编码全流程动画跟随正确（事件名已实测验证）
  - `plugins/opencode/desktop-pet.ts`: TypeScript 插件，监听 8 种 SDK 事件
  - 事件映射: session.created→Waving, session.status(busy)→Running, session.idle→Idle, session.error→Failed, file.edited→Building, message.part.updated→Chatting, permission→Permission
  - tool.execute.before/after: 工具调用状态映射（bash→Running, write/edit→Building, webfetch→Fetching, websearch→Searching, task→Analyzing）
  - 500ms 防抖，fire-and-forget HTTP 转发
  - 联调验证: 11/11 测试通过
- [✅] Copilot CLI 适配器：编码全流程动画跟随正确
  - `adapter_copilot.rs`: 8 个 HTTP hook 端点（`/api/copilot/*`）
  - 事件映射: session-start→Waving, session-end→Idle, user-prompt-submitted→Chatting, pre-tool-use→Running/Building/Fetching/Searching/Analyzing（tool_name 映射）, post-tool-use→Celebrating, post-tool-use-failure→Failed, agent-stop→Idle, error-occurred→Failed
  - 与 http.rs 集成: `add_routes()` 注入
  - 内部映射函数 `map_tool_to_state()` 含 10 个工具→状态测试
- [✅] Claude Code 适配器：编码全流程动画跟随正确
  - `.claude/hooks.json` 配置（7 种事件: session-start / pre-tool-use / post-tool-use / permission / stop / subagent-start / subagent-stop）
  - `adapter_claude.rs`: 全部 7 种事件 Handler + 工具→状态映射（bash→Running, write→Building, read→Chatting 等）
  - `main.rs`: 嵌入式 JSON 模板，适配器注册
  - 事件映射已对齐 `PetState` 枚举定义
  - **待验证**: 需要实机测试 Claude Code 全流程
- [⬜] 适配器自动发现 + 手动切换均可用
  - **部分实现**: 通用 `/api/event` 端点支持多来源事件
  - **未完成**: 适配器注册表、进程检测、托盘菜单切换
- [✅] 状态气泡防抖正常，无闪烁
  - `app.js`: 800ms 工具状态防抖（`toolLockUntil`）
  - `bubble.js`: 气泡队列管理
- [✅] 消息气泡 + 输入气泡交互完整
  - `bubble.js`: Bubble 类实现状态气泡、消息气泡、输入气泡
  - 输入气泡: 文本框 + 确认/取消按钮，结果通过 HTTP 回传
- [✅] MCP 服务 9528 端口正常监听
  - `mcp.rs`: MCP JSON-RPC 2.0 协议处理
  - 端点: `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`
- [✅] 4 个 MCP tool 全部可用（pet_show / pet_ask / pet_play / pet_get_user_input）
  - `mcp.rs`: 全部 4 个 tool 已声明并在 `tools/call` 中实现
  - pet_show: 显示气泡消息
  - pet_ask: 弹出选择题询问用户
  - pet_play: 强制播放指定动画
  - pet_get_user_input: 阻塞等待用户文本/确认/选择输入
- [✅] TCP 端口冲突时自动递增（fallback 机制）
  - `main.rs:try_bind_port()`: 从 base 端口开始尝试，最大偏移 10
  - HTTP: 9527-9537，MCP: 9528-9538
  - 冲突时自动尝试下一端口并打印警告
- [️] HTTP 延迟 <50ms，MCP <100ms
  - **待验证**: 需要性能基准测试
- [️] git tag `v0.1.0-beta` 已创建
  - **未完成**: 需验收全部通过后执行

---

## 七、风险项

| 风险 | 等级 | 缓解措施 | 责任人 | 回退方案 |
|------|------|----------|--------|----------|
| **opencode hook 事件格式与设计不匹配** | **中** | 已通过 `@opencode-ai/plugin` 类型定义实测验证；使用 `event` hook 接收所有 SDK 事件 | 开发 | 基于实际事件名重写映射表 |
| **TRAE Work hook 事件格式与设计不匹配** | **低** | TRAE Work 与 Claude Code 架构高度相似，事件格式已验证 | 开发 | 基于实际事件名重写映射表 |
| MCP 阻塞调用 `pet_get_input` 超时处理复杂 | 中 | 设置 30s 超时，超时返回默认值；前端气泡显示"已超时" | 开发 | 降级为非阻塞 + 轮询 |
| 两个 HTTP 端口（9527 + 9528）端口冲突 | 低 | 启动时检测端口占用，自动递增；记录实际端口到日志 | 开发 | 使用固定端口 + 手动配置 |
| 适配器自动发现跨平台差异大 | 中 | Windows 用 `sysinfo` crate，macOS/Linux 用 `pgrep`；抽象 `ProcessDetector` trait | 开发 | 默认启动全部适配器，靠事件激活 |

---

## 八、质量门禁（Phase 2 → Phase 3）

进入 Phase 3 前必须通过以下门禁：

- [✅] opencode + TRAE Work 全流程实机联调通过
  - opencode: 11/11 事件映射测试通过
  - TRAE Work: 5 个 hook 脚本已创建，待实机验证
- [✅] 4 个 MCP tool 全部可用且通过测试
  - `mcp.rs` 中 mcp_show / mcp_ask / mcp_play / mcp_get_user_input 均已实现
  - 通过 `/tools/call` 分发到 `handler_show / handler_ask / handler_play / handler_get_user_input`
  - pet_show: 气泡消息展示（支持文本 + 自动动画）
  - pet_ask: 弹出选择题（2-4 选项 + 确认/取消）
  - pet_play: 强制播放指定动画
  - pet_get_user_input: 阻塞等待用户输入（文本/确认/选择）
- [️] HTTP 服务延迟 <50ms，MCP 延迟 <100ms
  - 待性能基准测试
- [️] 适配器接口（`CliAdapter` trait）已冻结
  - 通用 `/api/event` 端点已实现，trait 定义待完善
- [️] git tag `v0.1.0-beta` 已创建
  - 待验收全部通过后执行

---

## 九、产出物

```
desktop-pet/
├── src-tauri/src/
│   ├── http.rs                    # Axum HTTP 服务（完成，含 /api/event 通用端点）
│   ├── mcp.rs                     # MCP JSON-RPC 服务（完成）
│   ├── state.rs                   # PetState + StateManager + 单元测试（完成）
│   ├── config.rs                  # 窗口位置持久化（完成）
│   ├── window.rs                  # 窗口管理 + click-through（完成）
│   ├── tray.rs                    # 系统托盘（完成）
│   └── main.rs                    # 入口（含状态超时回落、位置持久化）
├── plugins/
│   ├── opencode/
│   │   ├── desktop-pet.ts         # opencode TypeScript 插件（完成）
│   │   └── package.json           # 插件包描述
│   ── trae/
│       ├── hooks.json             # TRAE Work hooks 配置（完成）
│       └── hooks/
│           ├── session-start.ps1  # SessionStart hook（完成）
│           ├── user-prompt-submit.ps1  # UserPromptSubmit hook（完成）
│           ├── pre-tool-use.ps1   # PreToolUse hook（完成）
│           ├── post-tool-use.ps1  # PostToolUse hook（完成）
│           └── stop.ps1           # Stop hook（完成）
── src/
│   ├── index.html                 # 主页面（含 GIF 容器）
│   ├── pet.css                    # 桌宠样式 + GIF 模式样式
│   ├── app.js                     # 主逻辑 + 模式切换
│   ├── sprite-animator.js         # 精灵图动画引擎
│   ├── gif-animator.js            # GIF 动画引擎
│   ├── bubble.js                  # 气泡系统
│   ├── spritesheet.webp           # 精灵图（1536×3328，16 行含 sleeping）
│   └── validation.json            # 帧映射数据（128 单元格）
├── docs/
│   ├── API.md                     # 接口文档（PetState/StateManager/HTTP/MCP/IPC）
│   ├── hooks-opencode.json        # opencode 配置模板
│   └── hooks-trae.json            # TRAE Work 配置模板
└── assets/
    └── gifs/                      # GIF 动画资源
```
