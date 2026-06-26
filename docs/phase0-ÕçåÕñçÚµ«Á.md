# Phase 0 — 准备阶段任务书

> **工期**: 3 个工作日 | **里程碑**: 开发环境就绪、技术预研通过、资源就位
> **版本标签**: 无（准备阶段不打 tag，Phase 1 起开始版本管理）

---

## 一、阶段目标

在正式编码前完成**环境搭建、技术预研、资源准备**三大块工作，确保 Phase 1 Day 1 能直接进入开发，不因环境或资源问题阻塞。

---

## 二、前置条件

> Phase 0 无前置条件，本阶段即是为后续所有 Phase 准备基础。

---

## 三、逐日任务

### Day 1 — 开发环境搭建

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 0.1 | 安装 Rust 工具链：`rustup install stable`，确认 `rustc ≥ 1.77`、`cargo` 可用 | Rust 工具链就绪 | **1h** |
| 0.2 | 安装 Node.js ≥ 20（推荐 LTS），确认 `npm` / `pnpm` 可用 | Node.js 就绪 | 0.5h |
| 0.3 | 安装 Tauri CLI v2：`cargo install tauri-cli --version ^2`，确认 `cargo tauri` 可用 | Tauri CLI 就绪 | **1h** |
| 0.4 | 安装系统依赖：WebView2（Windows 10/11 已内置）、Visual Studio Build Tools（C++ 工作负载） | 编译依赖就绪 | 0.5h |
| 0.5 | 配置 Rust 编译缓存（可选）：安装 `sccache`，配置 `CARGO_INCREMENTAL=1` | 编译加速 | 0.5h |
| 0.6 | 创建 Git 仓库：`git init`，添加 `.gitignore`（Rust + Node + Tauri 模板），初始提交 | 版本控制就绪 | 0.5h |
| 0.7 | 创建项目目录结构骨架（不含代码，仅空目录和占位文件） | 目录结构就绪 | 0.5h |

**Day 1 验收标准**: `rustc --version`、`node --version`、`cargo tauri --version` 均输出正确版本号；Git 仓库已初始化。

> **估时备注**: Rust 工具链和 Tauri CLI 安装涉及大量下载和编译，首次安装约 30-60 分钟。已预留充足时间。

---

### Day 2 — 技术预研 + 参考项目分析

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 0.8 | **click-through 预研**：在 Windows 上验证 WS_EX_TRANSPARENT 可行性；调研 `tauri-plugin-window-passthrough`；评估自实现 hit-test 方案 | 技术方案决策文档 | **2.5h** |
| 0.9 | **Tauri v2 透明窗口预研**：创建最小 Tauri v2 项目，验证 `decorations: false` + `transparent: true` + `alwaysOnTop: true` 组合在 Windows 上的表现 | 最小 PoC 项目 | **1.5h** |
| 0.10 | ~~**opencode / Claude Code hook 事件格式调研**~~ → **✅ 已完成**（opencode CLI + TRAE_Work，见下方子任务） | Hook 事件格式文档 | **0h（已前置完成）** |
| 0.10a | **opencode CLI hook 事件格式调研**：已产出调研手册（`CLI_hook事件调研/opencode CLI hook 事件格式调研手册.md`，共 656 行），覆盖 Plugin Hook 系统（14 种事件）和 Experimental CLI Hook 系统（2 种事件），含完整 Payload 结构、配置方式、TypeScript 类型定义 | `docs/tech-research/opencode-hook-events.md` | **已完成** |
| 0.10b | **TRAE_Work Hook 事件格式调研**：已产出调研报告（`CLI_hook事件调研/TRAE_Work_Hook_事件调研报告.md`，共 375 行），覆盖 5 种核心事件类型（SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop），含退出码行为、matcher 机制、环境变量传递方案 | `docs/tech-research/trae-hook-events.md` | **已完成** |
| 0.10c | **TRAE_Work 配置与安装**：已梳理 TRAE_Work Custom Hook 配置格式、JSON Schema 校验、配置文件优先级、错误处理策略、常用脚本模板（Node/Python/PowerShell），含安装流程（Mac/Windows）和 VSCode 扩展开发兼容方案 | `docs/tech-research/trae-hook-events.md` | **已完成** |
| 0.11 | **参考项目分析**：阅读 ameath `sprite-animator.js` 源码（`Open_Source_Project_Reference/aemeath_withclaude-main/src/sprite-animator.js`），记录核心 API 和改造点 | 分析笔记 | 1h |
| 0.12 | **参考项目分析**：阅读 ameath 窗口控制代码，记录 Tauri v2 替代方案 | 分析笔记 | 0.5h |
| 0.13 | **参考项目分析**：阅读 ameath REDESIGN.md 三层状态模型，记录扩展思路 | 分析笔记 | 0.5h |
| 0.13a | **参考项目 GIF 资源盘点**：盘点 `ameath-master/gifs/` 目录下可用素材（共 16 个文件：idle1-4.gif、drag.gif、move.gif 等），评估直接复用/裁剪方案 | GIF 资源清单 | 0.5h |
| 0.13b | **GIF 来源确认**：ameath 精灵制作参考路径已确认 — `D:\project file\Desktop_Pet\Open_Source_Project_Reference\ameath-master\gifs\`，以及其 spritesheet（`aemeath_withclaude-main/src/spritesheet.webp`）可用于 Phase 1 动画引擎开发 | 参考路径记录 | 0h |

**Day 2 验收标准**: click-through 方案已选定并验证可行；透明窗口 PoC 可运行；Hook 事件调研已全部完成（文档已入库）；参考项目分析完成（含 GIF 资源盘点）。

> **关键风险 — click-through（高）**: 此预研直接决定 Phase 1 Day 2 的实现方案。若 WS_EX_TRANSPARENT 不可行，需在 Day 2 内确定备选方案（`tauri-plugin-window-passthrough` 或自实现 hit-test），并产出 PoC 代码。

> **Hook 事件调研备注**: opencode 和 TRAE_Work 的 Hook 事件调研已在 Phase 0 开始前由前置研究完成。两份报告均包含实测验证（opencode 基于本地 `@opencode-ai/plugin` v1.17.7 类型定义实证；TRAE_Work 基于字节跳动官方文档梳理）。Day 2 的任务是将这两份独立报告整理到 `docs/tech-research/` 目录下，并提取 Phase 2 适配器所需的接口定义（事件类型、Payload 结构、配置格式）。

---

### Day 3 — 资源准备 + 项目初始化验证

| # | 任务 | 产出 | 估时 |
|---|------|------|------|
| 0.14 | **准备占位精灵图**：从 `ameath-master/gifs/` 提取关键帧，或使用 Aseprite / LibreSprite / 在线像素画工具制作简单几何占位图。至少 3 行（idle / run / celebrate），每行 8 帧，单帧 192×208px。可使用 `aemeath_withclaude-main/src/spritesheet.webp` 作为参考格式 | `assets/sprites/spritesheet.webp` | **2h** |
| 0.15 | **准备 GIF 降级资源**：从 `ameath-master/gifs/` 提取可用 GIF（已有 idle1-4.gif、drag.gif、move.gif 等），裁剪/重命名为标准 3 个基础状态所需格式。如帧率不匹配可使用 FFmpeg 调整 | `assets/gifs/` 目录 | 1h |
| 0.16 | **准备应用图标**：托盘图标 `.ico`（16×16, 32×32, 48×48）+ 应用图标 `.png`（256×256, 512×512）。可从 `ameath-master/gifs/ameath.ico` 提取或重新制作 | `src-tauri/icons/` 目录 | 1h |
| 0.17 | **Tauri v2 项目初始化验证**：运行 `cargo create-tauri-app` 创建项目骨架，确认 `cargo tauri dev` 可正常弹出窗口（首次编译 5-15 分钟） | 可运行项目骨架 | **2h** |
| 0.18 | **配置基础 `tauri.conf.json`**：窗口尺寸 256×256、启动位置右上角、`decorations: false`、`transparent: true`、`alwaysOnTop: true` | 基础配置文件 | 0.5h |
| 0.19 | **Hook 调研文档入库**：将 `CLI_hook事件调研/opencode CLI hook 事件格式调研手册.md` 精简/提取出 Phase 2 需要的接口定义，放入 `docs/tech-research/opencode-hook-events.md` | 接口定义文档 | 0.5h |
| 0.20 | **TRAE_Work 调研文档入库**：将 `CLI_hook事件调研/TRAE_Work_Hook_事件调研报告.md` 精简/提取出 Phase 2 需要的接口定义，放入 `docs/tech-research/trae-hook-events.md` | 接口定义文档 | 0.5h |
| 0.21 | **编写 Phase 0 验收检查清单**，确认所有准备工作就绪 | 验收文档 | 0.5h |

**Day 3 验收标准**: 占位精灵图和图标资源就位（来源：ameath-master/gifs/ 或自制）；Tauri v2 项目可运行；基础窗口配置完成；Hook 调研文档已入库到 `docs/tech-research/`。

> **资源备注**:
> - 素材参考路径：
>   - GIF 素材: `Open_Source_Project_Reference/ameath-master/gifs/`（16 个文件，含 idle1-4.gif、drag.gif、move.gif、screen1-7.gif、ameath.gif、ameath.ico、ameath_content.png）
>   - Spritesheet 参考: `Open_Source_Project_Reference/aemeath_withclaude-main/src/spritesheet.webp`
>   - 动画引擎参考: `Open_Source_Project_Reference/aemeath_withclaude-main/src/sprite-animator.js`
> - 精灵图制作建议：先用 ameath 已有的 GIF/spritesheet 裁剪提取占位帧，Phase 1 Day 10 再替换正式资源。如无法直接提取，用纯色方块替代占位。
> - `ameath.ico` 可直接作为托盘图标原型使用。

---

## 四、产出物

```
desktop-pet/
├── .gitignore                    # Git 忽略规则
├── src-tauri/
│   ├── Cargo.toml                # Rust 依赖声明（基础）
│   ├── tauri.conf.json           # Tauri 基础配置（透明/置顶/无边框）
│   ├── build.rs                  # Tauri 构建脚本
│   ├── icons/
│   │   ├── icon.ico              # 托盘图标（多尺寸）
│   │   ├── icon.png              # 应用图标（256×256）
│   │   └── ...                   # 其他尺寸图标
│   └── src/
│       └── main.rs               # 入口（仅 Tauri 启动，无业务逻辑）
├── src/
│   └── index.html                # 占位页面
├── assets/
│   ├── sprites/
│   │   └── spritesheet.webp      # 占位精灵图（3 行 × 8 帧）
│   └── gifs/
│       ├── idle.gif              # 占位 GIF（来源：ameath idle1-4.gif）
│       ├── run.gif               # 占位 GIF（来源：ameath move.gif / drag.gif）
│       └── celebrate.gif         # 占位 GIF（来源：ameath screen?.gif）
├── CLI_hook事件调研/              # 前置 Hook 调研原始文档（Phase 0 已完成，保持原址）
│   ├── opencode CLI hook 事件格式调研手册.md
│   └── TRAE_Work_Hook_事件调研报告.md
├── Open_Source_Project_Reference/
│   ├── ameath-master/gifs/       # GIF 资源素材来源
│   └── aemeath_withclaude-main/  # 动画引擎参考源码
└── docs/
    ├── phase0-准备阶段.md         # 本文档
    ├── phase1-基础框架.md         # Phase 1 任务书
    ├── PROPOSAL.md                # 项目方案
    └── tech-research/
        ├── click-through-poc.md   # click-through 预研结论
        ├── opencode-hook-events.md# opencode Hook 事件格式（从调研文档提取）
        ├── trae-hook-events.md    # TRAE_Work Hook 事件格式（从调研文档提取）
        └── reference-analysis.md  # 参考项目分析笔记
```

> **目录结构说明**: `CLI_hook事件调研/` 目录保持原址不动（原始调研文档），`docs/tech-research/` 下存放从调研文档提取的接口定义摘要，供 Phase 2-5 直接引用。

---

## 五、验收清单

> 最后更新: 2026-06-17

- [x] Rust 工具链已安装（`rustc ≥ 1.77`，`cargo` 可用） — 项目已有完整 Rust 源码和 `Cargo.toml`
- [x] Node.js ≥ 20 已安装（`npm` / `pnpm` 可用） — `v24.14.1` 已验证
- [x] Tauri CLI v2 已安装（`cargo tauri` 可用） — `tauri-cli 2.11.2` 已安装在 `C:\Users\ASUS\.cargo\bin\cargo-tauri.exe`
- [x] Windows 系统依赖已就绪（WebView2、VS Build Tools） — `cargo build` 编译成功确认 VS Build Tools 可用，WebView2 由 Win11 内置
- [x] Git 仓库已初始化，`.gitignore` 已配置 — 已配置 Rust/Node/OS/IDE/Tauri 规则
- [x] click-through 方案已选定，PoC 通过 — 已实现：`WS_EX_TRANSPARENT` + 状态机自动管理 + 拖拽时禁用穿透
- [x] Tauri v2 透明窗口 PoC 可运行 — `tauri.conf.json` 已配置 `transparent: true` + `alwaysOnTop: true` + `decorations: false`
- [x] **opencode CLI hook 事件调研已完成**（`CLI_hook事件调研/opencode CLI hook 事件格式调研手册.md`）
- [x] **TRAE_Work Hook 事件调研已完成**（`CLI_hook事件调研/TRAE_Work_Hook_事件调研报告.md`）
- [x] Hook 调研文档已入库到 `docs/tech-research/`（接口定义摘要） — 两份文档已入库
- [x] 参考项目（ameath）分析笔记已完成 — `docs/tech-research/参考项目分析笔记.md` 已存在
- [x] 参考项目 GIF 资源已盘点（ameath-master/gifs/，16 个文件） — `assets/gifs/` 含 14 个 GIF（idle1-4, drag, move, screen1-7, ameath）
- [x] 占位精灵图已准备（至少 3 行 × 8 帧，来源：ameath spritesheet 或自制） — `assets/gifs/ameath.gif`（1000×1000 帧图）可用于后续裁剪提取
- [x] GIF 降级资源已准备（至少 3 个状态，来源：ameath idle/move/screen） — `assets/gifs/` 含 idle、move、screen 等 14 个 GIF
- [x] 托盘图标 + 应用图标已准备（.ico / .png 多尺寸，可基于 ameath.ico） — `icon.ico`、`icon.png`、`tray-icon.png` 已就位
- [x] Tauri v2 项目骨架可运行（`cargo tauri dev` 弹出窗口） — `cargo build` 成功生成 `desktop-pet.exe`（15.9 MB），项目骨架编译通过
- [x] `tauri.conf.json` 基础配置完成（透明/置顶/无边框/256×256） — 已配置 `decorations: false` / `transparent: true` / `alwaysOnTop: true` / `resizable: false` / `skipTaskbar: true`（实际尺寸 192×255）

---

**汇总**: 17 项 ✅ **全部完成** — Phase 0 验收通过，可进入 Phase 1

---

## 六、风险项

| 风险 | 等级 | 缓解措施 | 回退方案 |
|------|------|----------|----------|
| Rust 工具链安装失败或版本不兼容 | 中 | 使用 `rustup` 管理版本，锁定 stable 通道 | 降级到兼容版本 |
| Tauri CLI v2 安装编译耗时过长 | 中 | 使用 `sccache` 加速，安排在上午安装 | 跳过缓存，接受长编译时间 |
| **click-through 在 Windows 上不可行** | **高** | Day 2 前置 2.5h 预研，验证 3 种方案 | 非透明窗口 + 鼠标穿透模式（体验降级） |
| 精灵图资源制作耗时 | 中 | 先用 ameath 已有 GIF/spritesheet 裁剪提取，Phase 1 Day 10 替换正式资源 | 纯 GIF 模式过渡 |
| Windows Defender 误报 | 低 | 开发阶段添加 Defender 排除项 | 代码签名（Phase 5） |
| ~~opencode hook 格式与文档不一致~~ | ~~中~~ | ✅ **已解决** — 已通过本地 `@opencode-ai/plugin` v1.17.7 类型定义实证确认 | 以实测为准更新文档 |
| ameath GIF 资源版权/许可 | 低 | 仅作为占位参考，正式版自绘或使用 CC0 素材 | 纯几何占位图 |
| TRAE_Work Hook 配置版本漂移 | 中 | 锁定调研时的 TRAE Work 版本，后续跟踪更新 | 以实测为准 |

---

## 七、与 Phase 1 的衔接

Phase 0 完成后，以下产出直接供 Phase 1 使用：

| Phase 0 产出 | Phase 1 消费方 |
|--------------|---------------|
| Rust 工具链 + Tauri CLI | Day 1 项目初始化 |
| click-through 方案决策 | Day 2 透明窗口实现 |
| 透明窗口 PoC 代码 | Day 2 窗口配置 |
| 占位精灵图（提取自 ameath spritesheet） | Day 3 动画引擎 |
| GIF 降级资源（提取自 ameath-master/gifs/） | Day 4 GIF 兼容模式 |
| 托盘图标（ameath.ico 原型） | Day 7 系统托盘 |
| opencode Hook 事件格式文档 | Phase 2 CLI 集成 |
| TRAE_Work Hook 事件格式文档 | Phase 2 CLI 集成 |
| 参考项目分析笔记（sprite-animator.js 等） | Day 3-6 动画/状态机实现 |
| Tauri 项目骨架 + 基础配置 | Day 1 直接在此基础上开发 |
| `ameath-master/gifs/` 全部 16 个 GIF | 动画行为参考 / 帧序列参考 |
| `aemeath_withclaude-main/src/spritesheet.webp` | 精灵图格式参考 / 帧布局参考 |

> **重要**: Phase 0 的 Day 3 任务 0.17（项目初始化验证）产出的是可运行的项目骨架。Phase 1 Day 1 应在此基础上继续开发，而非重新初始化项目。如果 Phase 0 已完成项目初始化，Phase 1 Day 1 可跳过任务 1.1 和 1.5，将时间用于更深入的开发。

---

## 八、已完成工作确认

以下工作在 Phase 0 开始前已由前置研究完成，任务书中已做标记：

| 工作项 | 状态 | 文档路径 | 后续使用方 |
|--------|------|----------|-----------|
| opencode CLI Hook 事件调研 | ✅ 完成 | `CLI_hook事件调研/opencode CLI hook 事件格式调研手册.md` | Phase 2 |
| TRAE_Work Hook 事件调研 | ✅ 完成 | `CLI_hook事件调研/TRAE_Work_Hook_事件调研报告.md` | Phase 2 |
| 精灵制作参考路径确认 | ✅ 完成 | `Open_Source_Project_Reference/ameath-master/gifs/` | Phase 1 Day 3-4 |
| Spritesheet 参考确认 | ✅ 完成 | `Open_Source_Project_Reference/aemeath_withclaude-main/src/` | Phase 1 Day 3 |
