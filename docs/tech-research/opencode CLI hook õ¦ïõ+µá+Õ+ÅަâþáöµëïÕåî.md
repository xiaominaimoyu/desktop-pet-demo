# opencode CLI hook 事件格式调研手册

> **项目：** 通用 CLI 编码状态感知桌宠 ｜ **阶段：** Phase 0 预研
> **目的：** 明确 opencode CLI 支持的 hook 事件类型、Payload 结构、配置方式，为 Phase 2 适配器实现提供准确输入
> **适用版本：** opencode v1.17.7（锁定于本地安装版本）
> **调研日期：** 2026-06-17

---

## 一、调研总览

调研采用 **「四路并行 + 一项实证」** 的方法：

| 路径 | 方法 | 状态 | 关键发现 |
|------|------|------|----------|
| 路径 1 | 官方文档调研 | ✅ 完成 | 官方文档 https://opencode.ai/docs/plugins/ 提供了完整的 Plugin Hook 接口定义 |
| 路径 2 | 源码分析 | ✅ 完成 | 本地 `@opencode-ai/plugin` v1.17.7 的 `index.d.ts` 提供了权威的 Hooks 接口定义；`@opencode-ai/sdk` 提供了完整的 Event 类型定义 |
| 路径 3 | 配置文件 Schema 反推 | ✅ 完成 | 官方 JSON Schema (`https://opencode.ai/config.json`) 确认了 `experimental.hook` 配置结构 |
| 路径 4 | 社区与生态调研 | ✅ 完成 | 发现 opencode-claude-hooks、opencode-yaml-hooks 等社区插件 |
| 实证测试 | 本地类型定义验证 | ✅ 完成 | 通过读取本地 npm 包的 `.d.ts` 文件交叉验证了所有类型定义 |

> **核心原则：** 前三路调研结果已通过本地安装的 `@opencode-ai/plugin` 和 `@opencode-ai/sdk` 类型定义实证确认。

---

## 二、Hook 系统架构总览

opencode 提供 **两套 Hook 系统**：

### 2.1 Plugin Hook 系统（TypeScript，主系统）

- **配置方式：** `opencode.jsonc` → `"plugin": ["package-name"]` 或本地 `.ts`/`.js` 文件
- **接口定义：** `@opencode-ai/plugin` 包的 `Hooks` 接口
- **插件签名：** `(input: PluginInput, options?: PluginOptions) => Promise<Hooks>`
- **加载优先级：** 全局配置 → 项目配置 → 全局插件目录 → 项目插件目录

### 2.2 Experimental CLI Hook 系统（JSON 配置，命令式）

- **配置方式：** `opencode.jsonc` → `"experimental.hook"`
- **仅支持两个事件：** `file_edited` 和 `session_completed`
- **执行方式：** 运行 shell 命令，支持环境变量模板替换

---

## 三、Plugin Hook 事件完整清单

### 3.1 核心 Hook 事件

| # | Hook 名称 | 触发时机 | Input 类型 | Output 类型 | 可修改 | 描述 |
|---|-----------|----------|-----------|-------------|--------|------|
| 1 | `dispose` | 插件卸载时 | 无 | `Promise<void>` | 否 | 清理资源 |
| 2 | `event` | 任何 SDK 事件触发时 | `{ event: Event }` | `Promise<void>` | 否（观察者） | 接收所有 SDK 事件 |
| 3 | `config` | 插件初始化时 | `Config` | `Promise<void>` | 是（可变） | 修改运行时配置 |
| 4 | `tool` | 插件注册时 | — | `{ [key: string]: ToolDefinition }` | 是（定义工具） | 注册自定义工具 |
| 5 | `auth` | 插件注册时 | — | `AuthHook` | 是（定义认证） | 注册认证提供者 |
| 6 | `provider` | 插件注册时 | — | `ProviderHook` | 是（定义模型） | 注册模型提供者 |

### 3.2 Chat 相关 Hook

| # | Hook 名称 | 触发时机 | Input | Output | 可修改 |
|---|-----------|----------|-------|--------|--------|
| 7 | `chat.message` | 新消息接收时 | `{ sessionID: string, agent?: string, model?: { providerID: string, modelID: string }, messageID?: string, variant?: string }` | `{ message: UserMessage, parts: Part[] }` | 是 |
| 8 | `chat.params` | LLM 请求参数构建时 | `{ sessionID: string, agent: string, model: Model, provider: ProviderContext, message: UserMessage }` | `{ temperature: number, topP: number, topK: number, maxOutputTokens: number \| undefined, options: Record<string, any> }` | 是 |
| 9 | `chat.headers` | LLM HTTP 请求头构建时 | `{ sessionID: string, agent: string, model: Model, provider: ProviderContext, message: UserMessage }` | `{ headers: Record<string, string> }` | 是 |

### 3.3 权限与命令 Hook

| # | Hook 名称 | 触发时机 | Input | Output | 可修改 |
|---|-----------|----------|-------|--------|--------|
| 10 | `permission.ask` | 权限请求时 | `Permission` | `{ status: "ask" \| "deny" \| "allow" }` | 是 |
| 11 | `command.execute.before` | 斜杠命令执行前 | `{ command: string, sessionID: string, arguments: string }` | `{ parts: Part[] }` | 是 |

### 3.4 工具执行 Hook

| # | Hook 名称 | 触发时机 | Input | Output | 可修改 |
|---|-----------|----------|-------|--------|--------|
| 12 | `tool.execute.before` | 工具执行前 | `{ tool: string, sessionID: string, callID: string }` | `{ args: any }` | 是 |
| 13 | `tool.execute.after` | 工具执行后 | `{ tool: string, sessionID: string, callID: string, args: any }` | `{ title: string, output: string, metadata: any }` | 是 |
| 14 | `tool.definition` | 工具定义发送给 LLM 前 | `{ toolID: string }` | `{ description: string, parameters: any }` | 是 |

### 3.5 Shell 环境 Hook

| # | Hook 名称 | 触发时机 | Input | Output | 可修改 |
|---|-----------|----------|-------|--------|--------|
| 15 | `shell.env` | Shell 环境变量构建时 | `{ cwd: string, sessionID?: string, callID?: string }` | `{ env: Record<string, string> }` | 是 |

### 3.6 Experimental Hook

| # | Hook 名称 | 触发时机 | Input | Output | 可修改 |
|---|-----------|----------|-------|--------|--------|
| 16 | `experimental.chat.messages.transform` | 消息发送给 LLM 前 | `{}` | `{ messages: { info: Message, parts: Part[] }[] }` | 是 |
| 17 | `experimental.chat.system.transform` | 系统提示词构建时 | `{ sessionID?: string, model: Model }` | `{ system: string[] }` | 是 |
| 18 | `experimental.provider.small_model` | 小模型选择时 | `{ provider: ProviderV2 }` | `{ model?: ModelV2 }` | 是 |
| 19 | `experimental.session.compacting` | 会话压缩开始前 | `{ sessionID: string }` | `{ context: string[], prompt?: string }` | 是 |
| 20 | `experimental.compaction.autocontinue` | 压缩后自动继续判断时 | `{ sessionID: string, agent: string, model: Model, provider: ProviderContext, message: UserMessage, overflow: boolean }` | `{ enabled: boolean }` | 是 |
| 21 | `experimental.text.complete` | 文本补全时 | `{ sessionID: string, messageID: string, partID: string }` | `{ text: string }` | 是 |

---

## 四、SDK Event 类型完整清单

### 4.1 v1 SDK Event（Plugin `event` Hook 接收的事件）

通过 `event` Hook 接收，事件类型通过 `event.type` 判断。

| # | 事件类型 (event.type) | 触发时机 | Properties |
|---|----------------------|----------|------------|
| 1 | `server.instance.disposed` | 服务器实例销毁 | `{ directory: string }` |
| 2 | `installation.updated` | 安装版本更新 | `{ version: string }` |
| 3 | `installation.update-available` | 有可用更新 | `{ version: string }` |
| 4 | `lsp.client.diagnostics` | LSP 发送诊断 | `{ serverID: string, path: string }` |
| 5 | `lsp.updated` | LSP 状态变更 | `{ [key: string]: unknown }` |
| 6 | `message.updated` | 消息更新 | `{ info: Message }` |
| 7 | `message.removed` | 消息删除 | `{ sessionID: string, messageID: string }` |
| 8 | `message.part.updated` | 消息部分更新 | `{ part: Part, delta?: string }` |
| 9 | `message.part.removed` | 消息部分删除 | `{ sessionID: string, messageID: string, partID: string }` |
| 10 | `permission.updated` | 权限状态变更 | `Permission` 对象 |
| 11 | `permission.replied` | 用户回复权限请求 | `{ sessionID: string, permissionID: string, response: string }` |
| 12 | `session.status` | 会话状态变更 | `{ sessionID: string, status: SessionStatus }` |
| 13 | `session.idle` | 会话空闲 | `{ sessionID: string }` |
| 14 | `session.compacted` | 会话压缩完成 | `{ sessionID: string }` |
| 15 | `file.edited` | 文件被编辑 | `{ file: string }` |
| 16 | `todo.updated` | Todo 列表变更 | `{ sessionID: string, todos: Array<Todo> }` |
| 17 | `command.executed` | 斜杠命令执行完成 | `{ name: string, sessionID: string, arguments: string, messageID: string }` |
| 18 | `session.created` | 新会话创建 | `{ info: Session }` |
| 19 | `session.updated` | 会话更新 | `{ info: Session }` |
| 20 | `session.deleted` | 会话删除 | `{ info: Session }` |
| 21 | `session.diff` | 会话差异生成 | `{ sessionID: string, diff: Array<FileDiff> }` |
| 22 | `session.error` | 会话错误 | `{ sessionID?: string, error?: ErrorType }` |
| 23 | `file.watcher.updated` | 文件监视器检测到变更 | `{ file: string, event: "add" \| "change" \| "unlink" }` |
| 24 | `vcs.branch.updated` | VCS 分支变更 | `{ branch?: string }` |
| 25 | `tui.prompt.append` | TUI 提示追加 | `{ text: string }` |
| 26 | `tui.command.execute` | TUI 命令执行 | `{ command: string }` |
| 27 | `tui.toast.show` | TUI Toast 显示 | `{ title?: string, message: string, variant: "info" \| "success" \| "warning" \| "error", duration?: number }` |
| 28 | `pty.created` | PTY 创建 | `{ info: Pty }` |
| 29 | `pty.updated` | PTY 更新 | `{ info: Pty }` |
| 30 | `pty.exited` | PTY 退出 | `{ id: string, exitCode: number }` |
| 31 | `pty.deleted` | PTY 删除 | `{ id: string }` |
| 32 | `server.connected` | 服务器连接 | `{ [key: string]: unknown }` |

### 4.2 v2 SDK 新增 Event（Next API 细粒度事件）

v2 SDK 在 v1 基础上新增了以下事件，提供更细粒度的会话生命周期追踪：

| # | 事件类型 | 触发时机 | Properties |
|---|---------|----------|------------|
| 33 | `message.part.delta` | 消息部分增量更新 | `{ sessionID, messageID, partID, field, delta }` |
| 34 | `permission.asked` | 权限请求（v2 重命名） | `PermissionRequest` |
| 35 | `question.asked` | 问题被提出 | `QuestionRequest` |
| 36 | `question.replied` | 问题被回复 | `QuestionReplied` |
| 37 | `question.rejected` | 问题被拒绝 | `QuestionRejected` |
| 38 | `mcp.tools.changed` | MCP 工具列表变更 | `{ server: string }` |
| 39 | `mcp.browser.open.failed` | MCP 浏览器打开失败 | `{ mcpName: string, url: string }` |
| 40 | `project.updated` | 项目更新 | `Project` |
| 41 | `workspace.ready` | 工作区就绪 | `{ name: string }` |
| 42 | `workspace.failed` | 工作区失败 | `{ message: string }` |
| 43 | `workspace.status` | 工作区状态 | `{ workspaceID, status: "connected" \| "connecting" \| "disconnected" \| "error" }` |
| 44 | `worktree.ready` | 工作树就绪 | `{ name: string, branch?: string }` |
| 45 | `worktree.failed` | 工作树失败 | `{ message: string }` |
| 46 | `global.disposed` | 全局销毁 | `{ [key: string]: unknown }` |
| 47 | `catalog.model.updated` | 模型目录更新 | — |

#### v2 会话步骤事件（session.next.*）

| # | 事件类型 | 触发时机 | Properties |
|---|---------|----------|------------|
| 48 | `session.next.agent.switched` | Agent 切换 | `{ timestamp, sessionID, agent }` |
| 49 | `session.next.model.switched` | 模型切换 | `{ timestamp, sessionID, model: { id, providerID, variant } }` |
| 50 | `session.next.prompted` | 用户提示 | `{ timestamp, sessionID, prompt }` |
| 51 | `session.next.synthetic` | 合成消息 | `{ timestamp, sessionID, text }` |
| 52 | `session.next.shell.started` | Shell 命令开始 | `{ timestamp, sessionID, callID, command }` |
| 53 | `session.next.shell.ended` | Shell 命令结束 | `{ timestamp, sessionID, callID, output }` |
| 54 | `session.next.step.started` | 步骤开始 | `{ timestamp, sessionID, agent, model: { id, providerID, variant }, snapshot? }` |
| 55 | `session.next.step.ended` | 步骤结束 | `{ timestamp, sessionID, finish, cost, tokens: { input, output, reasoning, cache: { read, write } }, snapshot? }` |
| 56 | `session.next.step.failed` | 步骤失败 | `{ timestamp, sessionID, error }` |
| 57 | `session.next.text.started` | 文本生成开始 | `{ timestamp, sessionID }` |
| 58 | `session.next.text.delta` | 文本增量 | `{ timestamp, sessionID, delta }` |
| 59 | `session.next.text.ended` | 文本生成结束 | `{ timestamp, sessionID, text }` |
| 60 | `session.next.reasoning.started` | 推理开始 | `{ timestamp, sessionID, reasoningID }` |
| 61 | `session.next.reasoning.delta` | 推理增量 | `{ timestamp, sessionID, reasoningID, delta }` |
| 62 | `session.next.reasoning.ended` | 推理结束 | `{ timestamp, sessionID, reasoningID, text }` |
| 63 | `session.next.tool.input.started` | 工具输入开始 | `{ timestamp, sessionID, callID, name }` |
| 64 | `session.next.tool.input.delta` | 工具输入增量 | `{ timestamp, sessionID, callID, delta }` |
| 65 | `session.next.tool.input.ended` | 工具输入结束 | `{ timestamp, sessionID, callID, text }` |
| 66 | `session.next.tool.called` | 工具调用 | `{ timestamp, sessionID, callID, tool, input, provider: { executed, metadata? } }` |
| 67 | `session.next.tool.progress` | 工具进度 | `{ timestamp, sessionID, callID, structured, content }` |
| 68 | `session.next.tool.success` | 工具成功 | `{ timestamp, sessionID, callID, structured, content, provider }` |
| 69 | `session.next.tool.failed` | 工具失败 | `{ timestamp, sessionID, callID, error, provider }` |
| 70 | `session.next.retried` | 重试 | `{ timestamp, sessionID, attempt, error }` |
| 71 | `session.next.compaction.started` | 压缩开始 | `{ timestamp, sessionID, reason: "auto" \| "manual" }` |
| 72 | `session.next.compaction.delta` | 压缩增量 | `{ timestamp, sessionID, text }` |
| 73 | `session.next.compaction.ended` | 压缩结束 | `{ timestamp, sessionID, text, include? }` |

---

## 五、Experimental CLI Hook 配置

### 5.1 配置 Schema

```typescript
interface ExperimentalHook {
  file_edited?: {
    // glob 模式匹配文件路径
    [globPattern: string]: Array<{
      command: Array<string>;       // 要执行的命令（数组形式）
      environment?: {
        [key: string]: string;      // 环境变量，支持模板替换
      };
    }>;
  };
  session_completed?: Array<{
    command: Array<string>;
    environment?: {
      [key: string]: string;
    };
  }>;
}
```

### 5.2 环境变量模板

环境变量值支持以下模板替换：
- `{event.properties.file}` — 替换为事件属性中的 `file` 字段
- `{event.properties.sessionID}` — 替换为事件属性中的 `sessionID` 字段
- 其他 `event.properties.*` 字段均可引用

### 5.3 配置示例

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "experimental": {
    "hook": {
      "file_edited": {
        "**/*.ts": [
          {
            "command": ["echo", "Edited: $FILE_PATH"],
            "environment": { "FILE_PATH": "{event.properties.file}" }
          }
        ],
        "**/*.{js,jsx,ts,tsx}": [
          {
            "command": ["npx", "prettier", "--write", "$FILE_PATH"],
            "environment": { "FILE_PATH": "{event.properties.file}" }
          }
        ]
      },
      "session_completed": [
        {
          "command": ["notify-send", "opencode", "Session completed"],
          "environment": { "SESSION_ID": "{event.properties.sessionID}" }
        }
      ]
    }
  }
}
```

---

## 六、Plugin Hook 完整 Payload 结构

### 6.1 PluginInput 类型

```typescript
type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>;  // SDK 客户端
  project: Project;                                  // 项目信息
  directory: string;                                  // 工作目录
  worktree: string;                                   // 工作树路径
  experimental_workspace: {
    register(type: string, adapter: WorkspaceAdapter): void;
  };
  serverUrl: URL;                                     // 服务器 URL
  $: BunShell;                                        // Shell 执行器
};
```

### 6.2 关键辅助类型

```typescript
// Provider 上下文
type ProviderContext = {
  source: "env" | "config" | "custom" | "api";
  info: Provider;
  options: Record<string, any>;
};

// Session 状态
type SessionStatus =
  | { type: "idle" }
  | { type: "retry"; attempt: number; message: string; next: number }
  | { type: "busy" };

// Permission 对象
type Permission = {
  id: string;
  type: string;
  pattern?: string | Array<string>;
  sessionID: string;
  messageID: string;
  callID?: string;
  title: string;
  metadata: { [key: string]: unknown };
  time: { created: number };
};

// Todo 对象
type Todo = {
  content: string;
  status: string;      // "pending" | "in_progress" | "completed" | "cancelled"
  priority: string;     // "high" | "medium" | "low"
  id: string;
};

// FileDiff 对象
type FileDiff = {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
};

// UserMessage 对象
type UserMessage = {
  id: string;
  sessionID: string;
  role: "user";
  time: { created: number };
  summary?: { title?: string; body?: string; diffs: Array<FileDiff> };
  agent: string;
  model: { providerID: string; modelID: string };
  system?: string;
  tools?: { [key: string]: boolean };
};

// PTY 对象
type Pty = {
  id: string;
  title: string;
  command: string;
  args: Array<string>;
  cwd: string;
  status: "running" | "exited";
  pid: number;
};
```

---

## 七、Plugin Hook 执行流程

### 7.1 Hook 注册与调用顺序

```
opencode 启动
  └─ 加载插件（按优先级：全局配置 → 项目配置 → 全局插件目录 → 项目插件目录）
     └─ 调用 Plugin(input) → 返回 Hooks 对象
        ├─ config(input)           ← 立即调用，修改运行时配置
        ├─ auth                    ← 注册认证提供者
        ├─ provider                ← 注册模型提供者
        └─ tool                    ← 注册自定义工具

运行时事件分发：
  └─ event({ event })             ← 所有 SDK 事件
  └─ chat.message(input, output)  ← 新消息时
  └─ chat.params(input, output)   ← LLM 参数构建时
  └─ chat.headers(input, output)  ← HTTP 头构建时
  └─ command.execute.before(input, output) ← 命令执行前
  └─ tool.execute.before(input, output)    ← 工具执行前
  └─ tool.execute.after(input, output)     ← 工具执行后
  └─ experimental.*               ← 实验性 Hook
  └─ dispose()                    ← 插件卸载时
```

### 7.2 oh-my-opencode-slim 插件 Hook 调用链（实证）

```
event handler:
  ├─ multiplexerSessionManager.onSessionCreated(event)
  ├─ multiplexerSessionManager.onSessionStatus(event)
  ├─ multiplexerSessionManager.onSessionDeleted(event)
  ├─ foregroundFallback.handleEvent(input.event)
  ├─ todoContinuationHook.handleEvent(input)
  ├─ sessionGoalHook.handleEvent(input)
  ├─ autoUpdateChecker.event(input)
  ├─ interviewManager.handleEvent(input)
  └─ taskSessionManagerHook.event(input)

tool.execute.before handler:
  ├─ applyPatchHook["tool.execute.before"](input, output)
  └─ taskSessionManagerHook["tool.execute.before"](input, output)

tool.execute.after handler:
  ├─ delegateTaskRetryHook["tool.execute.after"](input, output)
  ├─ jsonErrorRecoveryHook["tool.execute.after"](input, output)
  ├─ todoContinuationHook.handleToolExecuteAfter(input, output)
  ├─ postFileToolNudgeHook["tool.execute.after"](input, output)
  └─ taskSessionManagerHook["tool.execute.after"](input, output)
```

---

## 八、社区生态与已知问题

### 8.1 社区插件

| 插件 | 仓库 | 功能 |
|------|------|------|
| `opencode-claude-hooks` | [shunkakinoki/opencode-claude-hooks](https://github.com/shunkakinoki/opencode-claude-hooks) | Claude Code hooks 兼容层，支持 PreToolUse/PostToolUse/Stop |
| `opencode-yaml-hooks` | [KristjanPikhof/OpenCode-Hooks](https://github.com/KristjanPikhof/OpenCode-Hooks) | YAML 配置式 Hook 系统，支持条件、阻塞、异步 |
| `oh-my-opencode-slim` | npm | 官方社区插件包，包含 12 个 Hook 实现 |

### 8.2 已知问题

| Issue | 描述 | 影响 |
|-------|------|------|
| [#2319](https://github.com/sst/opencode/issues/2319) | MCP 工具调用不触发 `tool.execute.before`/`tool.execute.after` | MCP 工具绕过所有 Hook |
| [#21149](https://github.com/sst/opencode/issues/21149) | `tool.execute.after` 对 MCP 工具收到原始 `CallToolResult` | 插件读取 `output.output` 为 `undefined` |
| [#12472](https://github.com/anomalyco/opencode/issues/12472) | `session.idle` 是 fire-and-forget，无法重新激活 Agent | Stop Hook 兼容性受限 |

### 8.3 常见使用模式

| 用例 | Hook | 模式 |
|------|------|------|
| 阻止危险命令 | `tool.execute.before` | 检查 `input.tool === "bash"`，抛出错误 |
| 编辑后格式化 | `event` (file.edited) | 匹配文件扩展名，运行 prettier/eslint |
| 保护 .env 文件 | `tool.execute.before` | 检查 `output.args.filePath`，抛出错误 |
| 自动提交 | `event` (file.edited) | 异步运行 git commit |
| 会话通知 | `event` (session.idle) | 发送桌面通知 |
| 注入环境变量 | `shell.env` | 设置 `output.env` |
| 修改 LLM 参数 | `chat.params` | 修改 `output.temperature` 等 |
| 自定义压缩提示 | `experimental.session.compacting` | 追加 `output.context` 或替换 `output.prompt` |

---

## 九、配置文件完整参考

### 9.1 Plugin 配置

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "npm-package-name",                    // npm 包名
    ["npm-package-name", { "key": "val" }] // 带选项的 npm 包
  ]
}
```

### 9.2 Plugin 加载路径

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | 远程配置 (`.well-known/opencode`) | 组织级默认 |
| 2 | 全局配置 (`~/.config/opencode/opencode.json`) | 用户偏好 |
| 3 | 环境变量 (`OPENCODE_CONFIG`) | 自定义覆盖 |
| 4 | 项目配置 (`opencode.json`) | 项目特定 |
| 5 | `.opencode` 目录 | agents, commands, plugins |
| 6 | 环境变量 (`OPENCODE_CONFIG_CONTENT`) | 运行时覆盖 |

### 9.3 Experimental Hook 配置

```jsonc
{
  "experimental": {
    "hook": {
      "file_edited": {
        "<glob-pattern>": [
          {
            "command": ["command", "arg1", "arg2"],
            "environment": {
              "ENV_VAR": "{event.properties.fieldName}"
            }
          }
        ]
      },
      "session_completed": [
        {
          "command": ["command", "arg1"],
          "environment": {
            "SESSION_ID": "{event.properties.sessionID}"
          }
        }
      ]
    }
  }
}
```

---

## 十、Plugin 开发模板

### 10.1 最小插件

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")
  return {}
}
```

### 10.2 事件监听插件

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const NotificationPlugin: Plugin = async ({ client }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        // 会话空闲时发送通知
        console.log(`Session ${event.properties.sessionID} is idle`)
      }
      if (event.type === "file.edited") {
        // 文件编辑时触发
        console.log(`File edited: ${event.properties.file}`)
      }
    },
  }
}
```

### 10.3 工具拦截插件

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const SafetyPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash") {
        // 检查并修改 bash 命令参数
        const cmd = output.args?.command
        if (typeof cmd === "string" && cmd.includes("rm -rf")) {
          throw new Error("Dangerous command blocked")
        }
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool === "write" || input.tool === "edit") {
        // 文件写入后自动格式化
        console.log(`File operation completed: ${input.tool}`)
      }
    },
  }
}
```

### 10.4 会话感知插件（桌宠适配器参考）

```typescript
import type { Plugin, Event } from "@opencode-ai/plugin"

export const DesktopPetPlugin: Plugin = async ({ client }) => {
  let currentStatus: "idle" | "busy" | "error" = "idle"
  let currentSession: string | null = null

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.created":
          currentSession = event.properties.info.id
          currentStatus = "busy"
          break
        case "session.status":
          if (event.properties.status.type === "idle") {
            currentStatus = "idle"
          } else if (event.properties.status.type === "busy") {
            currentStatus = "busy"
          } else if (event.properties.status.type === "retry") {
            currentStatus = "error"
          }
          break
        case "session.idle":
          currentStatus = "idle"
          break
        case "session.error":
          currentStatus = "error"
          break
        case "file.edited":
          // 文件编辑事件
          console.log(`File: ${event.properties.file}`)
          break
        case "message.part.updated":
          // 流式文本输出
          if (event.properties.part.type === "text" && event.properties.delta) {
            process.stdout.write(event.properties.delta)
          }
          break
        case "todo.updated":
          // Todo 列表变更
          console.log(`Todos: ${event.properties.todos.length} items`)
          break
      }
    },
  }
}
```

---

## 十一、对桌宠适配器设计的关键结论

### 11.1 推荐使用的 Hook/Event

对于「通用 CLI 编码状态感知桌宠」，以下事件最为关键：

| 优先级 | 事件 | 用途 |
|--------|------|------|
| P0 | `session.status` / `session.idle` | 检测 Agent 空闲/忙碌/重试状态 |
| P0 | `session.error` | 检测错误状态 |
| P0 | `session.created` / `session.deleted` | 会话生命周期 |
| P1 | `message.part.updated` (delta) | 流式文本输出（实时显示 Agent 思考） |
| P1 | `todo.updated` | Todo 列表变更（进度追踪） |
| P1 | `file.edited` | 文件编辑事件（桌宠动画反馈） |
| P2 | `tool.execute.before` / `tool.execute.after` | 工具调用状态 |
| P2 | `session.next.step.started` / `session.next.step.ended` | 步骤级进度（v2） |
| P2 | `session.next.tool.called` / `session.next.tool.success` / `session.next.tool.failed` | 工具级进度（v2） |

### 11.2 推荐接入方式

1. **Plugin 方式（推荐）：** 编写 TypeScript 插件，通过 `event` Hook 接收所有事件，通过 WebSocket/HTTP 转发给桌宠进程
2. **Experimental CLI Hook 方式（简单场景）：** 使用 `experimental.hook.file_edited` 和 `session_completed` 执行命令通知桌宠
3. **SDK 直接订阅（高级）：** 使用 `@opencode-ai/sdk` 的 `event.subscribe` API 直接订阅 SSE 事件流

### 11.3 注意事项

- `session.idle` 是 fire-and-forget，无法通过返回值重新激活 Agent
- MCP 工具调用不触发 `tool.execute.before`/`tool.execute.after`
- `tool.execute.after` 对 MCP 工具的 `output.output` 可能为 `undefined`
- v2 SDK 事件比 v1 更细粒度，但需要使用 v2 API 端点
- 所有 Hook 函数均为 `async`，需返回 `Promise<void>`
- 多个插件的 Hook 按加载顺序串行执行

---

## 十二、版本锁定信息

| 组件 | 版本 | 来源 |
|------|------|------|
| opencode CLI | v1.17.7 | `opencode --version` |
| @opencode-ai/plugin | 本地 npm 包 | `oh-my-opencode-slim/node_modules/@opencode-ai/plugin` |
| @opencode-ai/sdk (v1) | 本地 npm 包 | `oh-my-opencode-slim/node_modules/@opencode-ai/sdk` |
| @opencode-ai/sdk (v2) | 本地 npm 包 | `oh-my-opencode-slim/node_modules/@opencode-ai/sdk/dist/v2` |
| oh-my-opencode-slim | 本地 npm 包 | `oh-my-opencode-slim` |
| 配置 Schema | https://opencode.ai/config.json | 官方 JSON Schema |
| 官方文档 | https://opencode.ai/docs/plugins/ | 官方 Plugin 文档 |

---

*本手册基于 opencode v1.17.7 的本地安装包类型定义、官方 JSON Schema、官方文档和社区资源交叉验证完成。*