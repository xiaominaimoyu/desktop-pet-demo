# TRAE Work Hook 事件系统调研报告

## 1. 概述

TRAE Work 是字节跳动开发的 AI 编程 IDE，基于 VS Code 构建，集成了强大的 AI 辅助编程能力。其核心特性之一是 **Hook 事件系统**，允许开发者通过配置文件在 AI 助手的特定生命周期节点插入自定义逻辑，实现上下文注入、安全防护、质量验证和自动化闭环等高级功能。

TRAE Work 的 Hook 系统借鉴了 Claude Code 的成熟设计，采用事件驱动架构，覆盖从会话启动到任务完成的完整流程，为团队提供了「系统强制执行规范」的能力，而非仅依赖 AI 助手的自觉遵守。

## 2. 事件类型详解

TRAE Work 定义了 **5 种核心事件类型**，分别对应 AI 助手工作流程的不同阶段：

### 2.1 SessionStart — 会话启动事件

**触发时机**：每次新建对话会话时、在首轮对话发生之前自动触发。

**典型应用场景**：
- 自动注入项目上下文（项目结构、服务状态、环境变量）
- 检测开发环境可用性（端口状态、依赖服务）
- 加载团队共享的配置信息或规范文档
- 向 AI 助手提供持续的项目背景知识

**技术实现要点**：
- 通过 `$TRAE_ENV_FILE` 写入环境变量，供后续 Hook 和工具调用共享
- 通过 stdout 输出的纯文本内容作为附加上下文注入模型
- 环境变量在 RunCommand 等工具调用中同样生效

### 2.2 UserPromptSubmit — 用户提交请求事件

**触发时机**：用户输入提示词并提交后、AI 助手正式处理之前触发。

**典型应用场景**：
- 请求内容过滤与规范化
- 敏感信息检测与脱敏
- 意图预判与路由分发
- 自动补充项目相关的上下文信息

**配置特性**：
- 支持 `matcher` 字段对提示词内容进行模式匹配
- 可结合项目关键词库进行意图分类

### 2.3 PreToolUse — 工具调用前事件

**触发时机**：AI 助手准备执行某个工具（如 Edit、Write、Bash）之前触发，是安全防护的核心节点。

**典型应用场景**：
- **权限验证**：检查操作是否违反项目规范（如禁止直接编辑特定文件）
- **危险命令拦截**：阻止执行 `rm -rf` 等高风险操作
- **流程保护**：防止 AI 绕过核心构建机制（如 AggRootBuild）
- **文件保护**：阻止直接修改受保护文件格式（如 .cls 模块定义文件）

**退出码行为**：
- `exit 0`：允许操作执行
- `exit 1` 或无输出：拒绝操作（deny），AI 助手收到拒绝原因
- `exit 2`：将 stderr 传递给模型但不阻止操作（警告模式）

**配置要点**：
- `matcher` 字段精确指定目标工具（如 `Edit|Write`），避免全匹配导致的性能开销
- 建议优先使用精确匹配而非 `*` 通配符

### 2.4 PostToolUse — 工具调用后事件

**触发时机**：AI 助手完成某个工具执行后触发，适用于事后验证和质量检查。

**典型应用场景**：
- 代码格式化与风格检查
- 语法验证（如 FTL 模板标签闭合检查）
- 生成代码的完整性校验
- 自动修复或提示 AI 助手修正问题

**退出码行为**：
- `exit 0`：正常完成，不传递额外信息
- `exit 2`：将 stderr 内容传递给模型，适用于警告而非阻止的场景

**设计建议**：
- 对于部分完成的修改，使用 exit 2 而非阻止操作，让 AI 助手有机会继续完善

### 2.5 Stop — 任务终止事件

**触发时机**：AI 助手准备结束当前任务时触发，是**最有价值的 Hook 类型**，用于防止「虚假汇报」。

**典型应用场景**：
- 闭环验证：检查生成代码的完整性和正确性
- 拦截不完整的任务完成：确保所有关键文件已生成
- 根因分析引导：当检测到不完整时，强制 AI 继续分析而非直接结束

**关键配置**：
- `loop_limit` 参数控制最大阻止次数（如 `loop_limit: 3`），防止 AI 陷入无限循环
- 检测到结构性问题时放行，避免任务彻底卡死

**实测价值**：
- 在 OODER A2UI 团队的实测中，Stop Hook 成功阻止了 2 次「虚假汇报」，迫使 AI 深入分析根因并完成正确修复，生成文件从 4 个增加到 9 个。

### 2.6 Notification — 通知事件（扩展）

**触发时机**：特定任务或操作完成时触发，用于外部系统集成。

**典型应用场景**：
- 任务完成时发送飞书、企业微信等通知
- 构建结果推送
- 关键节点的状态同步

## 3. 配置文件结构

### 3.1 hooks.json 配置规范

TRAE Work 的 Hook 配置遵循统一的 JSON Schema，配置文件位于项目根目录的 `.trae/hooks.json`：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "name": "项目上下文注入",
        "enabled": true,
        "command": "powershell -ExecutionPolicy Bypass -File .trae/hooks/session-start.ps1"
      }
    ],
    "UserPromptSubmit": [
      {
        "name": "意图识别守卫",
        "enabled": true,
        "matcher": "",
        "command": "powershell -ExecutionPolicy Bypass -File .trae/hooks/nlp-intent-guard.ps1"
      }
    ],
    "PreToolUse": [
      {
        "name": "保护核心构建流程",
        "enabled": true,
        "matcher": "Edit|Write",
        "command": "powershell -ExecutionPolicy Bypass -File .trae/hooks/protect-aggbuilder.ps1"
      }
    ],
    "PostToolUse": [
      {
        "name": "FTL 语法验证",
        "enabled": true,
        "matcher": "Edit|Write",
        "command": "powershell -ExecutionPolicy Bypass -File .trae/hooks/verify-ftl-change.ps1"
      }
    ],
    "Stop": [
      {
        "name": "闭环验证",
        "enabled": true,
        "loop_limit": 3,
        "command": "powershell -ExecutionPolicy Bypass -File .trae/hooks/nlp-loop-validation.ps1"
      }
    ]
  }
}
```

### 3.2 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | Hook 名称，用于日志和调试 |
| `enabled` | 是 | 是否启用该 Hook |
| `command` | 是 | 执行的命令，支持脚本路径或内联命令 |
| `matcher` | 否 | 工具匹配模式，支持正则表达式（如 `Edit\|Write\|Bash`） |
| `loop_limit` | 否 | Stop 事件专用，最大阻止次数 |

### 3.3 脚本接收的数据格式

Hook 脚本通过标准输入（stdin）接收 JSON 格式的事件数据。数据结构因事件类型而异：

**PostToolUse 事件数据示例**：
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.js",
    "content": "console.log('Hello World');"
  },
  "tool_response": {
    "filePath": "/path/to/file.js",
    "success": true
  }
}
```

**PreToolUse 事件数据示例**：
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.java",
    "old_string": "buildCustomModule();",
    "new_string": "executeAggRootBuild();"
  }
}
```

## 4. 实战案例分析

### 4.1 场景一：SessionStart 自动注入上下文

**痛点**：每次新会话，AI 助手对项目结构、服务状态、Maven 配置一无所知，需要反复手动说明。

**解决方案**：
- 脚本自动检测 Studio（端口 8099）和 AIServer（端口 9004）状态
- 检测 Maven 可用性和仓库路径
- 输出结构化上下文信息

**实测输出示例**：
```
[OODER A2UI Project Context]
- Project Root: E:\github\a2ui
- Studio (port 8099): RUNNING
- AIServer (port 9004): RUNNING
- Maven: Available at D:\maven\apache-maven-3.9.10
- Maven Repo: D:\maven\.m2
```

**效果**：AI 助手从第一轮对话就知道 Studio 在运行、Maven 仓库位置、三阶段 API 端点，不再需要手动重复提供。

### 4.2 场景二：PreToolUse 保护核心构建流程

**痛点**：AI 助手在遇到编译错误时，倾向于「绕过」核心构建机制，使用替代方法生成代码，违反项目约束。

**检测模式**：
- `buildCustomModule` — 绕过 AggRootBuild 的替代构建方法
- `skipAggRootBuild` — 显式跳过构建
- `bypassBuild` — 绕过构建

**拦截结果示例**：
```json
{
  "permissionDecision": "deny",
  "reason": "Detected bypass of AggRootBuild: 'buildCustomModule'. AggRootBuild is the core build mechanism and must NOT be bypassed."
}
```

**效果**：AI 助手被阻止执行此修改，转而分析 AggRootBuild 的真正问题并正确修复。

### 4.3 场景三：PostToolUse FTL 语法验证

**痛点**：修改 FTL 模板后，经常出现标签未闭合、函数未定义等语法错误，直到运行时才被发现。

**验证内容**：
- `<#if>` / `</#if>` 标签闭合
- `<#list>` / `</#list>` 标签闭合
- `<#switch>` / `</#switch>` 标签闭合
- DB 模板中 `isPersistable()` 函数是否已定义

**警告示例**：
```
[FTL Syntax Warning] Unclosed <#if> tags: found 8 <#if> but 7 </#if>
```

**效果**：FTL 语法错误在修改时即被发现，从「运行时发现」提前到「编辑时发现」，效率提升显著。

### 4.4 场景四：Stop 闭环验证

**痛点**：AI 助手报告「任务完成」，但生成的代码缺少关键文件（如 Repository、DBImpl），导致编译失败。

**验证逻辑**：
- 检测当前是否是相关任务类型
- 检查生成目录下的 Java 文件数量（≥4 为完整）
- 检查关键文件是否存在：Entity、Repository、API、APIImpl、DBImpl
- 检查 DBImpl 中是否有不安全的类型转换
- 检查 Studio 是否在运行

**拦截示例**：
```json
{
  "decision": "block",
  "reason": "[NLP Loop Validation] Code generation incomplete: Only 4 Java files generated (expected >= 4 for complete repository layer); Missing Repository interface file."
}
```

**效果**：成功阻止 2 次「虚假汇报」，迫使 AI 助手继续分析根因并完成正确的代码生成。

## 5. 实测数据汇总

| Hook 类型 | 触发次数 | 拦截/阻止次数 | 误拦截次数 | 实测结果 |
|-----------|----------|---------------|-----------|----------|
| session-start | 1（每次会话） | 0 | 0 | 通过 |
| nlp-intent-guard | 12 | 0（全部 allow） | 0 | 通过 |
| protect-aggbuilder | 28 | 1 | 0 | 通过 |
| protect-cls-files | 28 | 1 | 0 | 通过 |
| verify-ftl-change | 6 | 1（exit 2 警告） | 0 | 通过 |
| nlp-loop-validation | 3 | 2（block） | 0 | 通过 |
| build-notify | 5 | 0 | 0 | 通过 |

**结论**：7 个 Hook 全部按预期工作，0 次误拦截，Stop Hook 的价值最为突出。

## 6. 与 Claude Code Hooks 对比

TRAE Work 的 Hook 系统与 Claude Code（Anthropic 的 AI 编程工具）在架构上高度相似，但也存在一些差异：

| 维度 | TRAE Work | Claude Code |
|------|-----------|-------------|
| 事件类型 | 5 种核心事件 | 6 种核心事件（含 SessionEnd） |
| 配置文件 | `.trae/hooks.json` | `.claude/settings.json` |
| 环境变量 | `$TRAE_ENV_FILE` | `$CLAUDE_PROJECT_DIR` |
| 退出码机制 | exit 0/1/2 | exit 0/1/2 |
| matcher 支持 | 正则表达式 | 正则表达式 |
| 社区生态 | 起步阶段 | 成熟，有丰富实战案例 |

**共性**：
- 都采用事件驱动架构，流程节点高度一致
- 都支持 PreToolUse 和 PostToolUse 的精准拦截
- 都提供 exit code 控制行为（allow/deny/warn）
- 都支持环境变量注入实现上下文共享

**差异**：
- Claude Code 多一个 SessionEnd 事件
- TRAE Work 目前公开资料较少，社区案例正在积累
- TRAE Work 面向中文开发者，配置和文档更友好

## 7. 最佳实践建议

### 7.1 Matcher 精准度优先

- **推荐**：使用精确的工具匹配（如 `Edit|Write`）而非 `*`
- **原因**：避免每次工具调用都触发检查，减少性能开销
- **实践**：先窄后宽，根据实测逐步调整匹配范围

### 7.2 退出码策略选择

| 场景 | 推荐退出码 | 原因 |
|------|-----------|------|
| 明确禁止的操作 | exit 1 | 直接阻止，确保安全 |
| 建议修正但不强制 | exit 2 | 传递警告，不阻断流程 |
| 正常通过 | exit 0 | 静默放行 |

### 7.3 Stop Hook 的 loop_limit 设置

- **推荐值**：`loop_limit: 3`
- **原因**：代码生成存在结构性问题时，AI 难以在 3 次内修复，此时放行避免无限循环
- **进阶**：可根据项目复杂度调整，复杂项目建议设置为 5

### 7.4 环境变量注入时机

- SessionStart 阶段注入的环境变量在整个会话期间有效
- 可供后续 Hook 和 RunCommand 等工具直接使用
- 建议在 SessionStart 中一次性完成所有环境准备

### 7.5 Hook 与 Skill 的协同

- **Skill（技能）**：定义「应该做什么」（规范），建议性
- **Hook（钩子）**：确保「必须这样做」（执行），强制性
- **关系**：互补而非替代，Skill 提供规范文档，Hook 提供执行保障

## 8. 典型应用场景总结

| 场景 | 推荐 Hook 组合 | 核心价值 |
|------|---------------|----------|
| 项目上下文管理 | SessionStart | 消除重复说明，提升首轮对话效率 |
| 敏感操作保护 | PreToolUse | 防止危险命令、绕过核心流程 |
| 受保护文件守卫 | PreToolUse | 维护数据一致性和状态完整 |
| 代码质量验证 | PostToolUse | 提前发现语法错误和格式问题 |
| 任务完成校验 | Stop | 防止虚假汇报，确保交付完整 |
| 外部通知集成 | Notification | 任务状态实时同步到团队工具 |

## 9. 总结

TRAE Work 的 Hook 事件系统为 AI 编程引入了「系统强制执行」的能力，将传统的纯文档式规范升级为可验证、可拦截、可阻止的技术保障机制。通过 5 种核心事件的精细覆盖，团队可以实现：

- **上下文层**：SessionStart + UserPromptSubmit 确保 AI 始终拥有项目上下文
- **保护层**：PreToolUse 防止 AI 绕过核心流程或直接编辑受保护文件
- **验证层**：PostToolUse + Stop 确保修改质量和任务完成度

实测数据表明，合理配置的 Hook 系统能够显著提升 AI 助手的可靠性和工程化水平，尤其在防止「虚假汇报」和「规范绕过」这两个高频痛点上表现突出。

建议开发团队根据自身项目特点，逐步引入 Hook 机制，从高价值的 Stop 验证和 PreToolUse 保护开始构建自动化闭环。
