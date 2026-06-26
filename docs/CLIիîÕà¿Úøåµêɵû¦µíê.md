# CLI 适配器完全集成方案

> **目标**: 适配器自动发现 → 自动切换 → 生命周期管理 → 前端反馈，形成完整闭环
> **当前状态**: 适配器核心、注册表、进程检测均已实现，但各模块之间缺乏连接器（glue），
> 注册表生命周期局限于 spawn block 内部，托盘/前端无法感知适配器状态
> **版本**: v1.0 | **日期**: 2026-06-19

---

## 一、现状诊断

### 1.1 已实现（✅）vs 缺失（⬜）

```
✅ CliAdapter trait           ← adapter_trait.rs    统一接口
✅ 4 个适配器实现              ← adapter_claude/copilot/opencode/trae.rs
✅ AdapterRegistry             ← adapter_registry.rs 注册/启用/仲裁/路由合并
✅ ProcessDetector             ← process_detector.rs Windows 进程快照
✅ HTTP 路由合并               ← main.rs:173 merge_routes_into
✅ Claude Code hooks 自动写入  ← main.rs write_claude_hooks_json()
✅ 状态管理器 + 超时回落       ← state.rs + main.rs 5个后台任务
✅ 托盘菜单                    ← tray.rs
✅ 气泡系统                    ← bubble.js

⬜ Registry 可被全局访问       ← 创建在 spawn block 内部，外部不可达
⬜ 定期进程扫描任务            ← detect 函数存在但无人周期性调用
⬜ 托盘适配器切换菜单          ← 托盘菜单未暴露适配器选择
⬜ 前端适配器状态展示          ← 前端不知道哪个适配器活跃
⬜ 前端切换适配器 UI           ← 无手动切换入口
⬜ 非 Claude 适配器的 hooks 自动配置 ← 仅 Claude Code 有
⬜ 适配器就绪检查 (check_ready) 实际被调用 ← trait 定义了但未使用
⬜ 性能基准测试                ← Phase 2 checklist 遗留项
```

### 1.2 根本原因

`main.rs` 第 170-189 行，`AdapterRegistry` 创建后仅用于 `merge_routes_into`，引用未逃逸出
`tokio::spawn` 闭包。这导致：

- 托盘代码（`tray.rs`）无法枚举适配器列表
- 前端无法查询活跃适配器
- 没有后台任务能周期性调用 `scan_and_activate()`
- HTTP handler 无法知道当前活跃适配器是谁

---

## 二、目标架构

### 2.1 总览

```
┌──────────────────────────────────────────────────────────┐
│                        main.rs                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Tray Menu   │  │ HTTP Server  │  │ Background Tasks │  │
│  │ (tray.rs)   │  │ (http.rs)    │  │                  │  │
│  │             │  │              │  │ ProcessScanner──┐│  │
│  │ 适配器列表  │  │ /api/adapter │  │ (每 5s 扫描)    ││  │
│  │ 模式切换   │  │ /api/adapter │  │                 ││  │
│  │ 手动选择   │  │   /list      │  │ AutoConfig ─────┐│  │
│  └──────┬──────┘  │   /active   │  │ (hooks 自动部署) ││  │
│         │         │   /switch   │  └────────┬─────────┘│  │
│         │         └──────┬──────┘           │          │  │
│         │                │                  │          │  │
│         └──────────┬─────┴──────────────────┘          │  │
│                    ▼                                     │  │
│         ┌─────────────────────┐                          │  │
│         │  AdapterRegistry    │  ◄── Arc<RwLock<...>>   │  │
│         │  (全局共享)         │  所有模块通过 Arc 访问   │  │
│         └─────────┬───────────┘                          │  │
│                   │                                      │  │
│          ┌────────┼────────┐                             │  │
│          ▼        ▼        ▼                             │  │
│    ┌──────┐ ┌──────┐ ┌──────┐                            │  │
│    │Claude│ │OpenC │ │Copilt│  ...                       │  │
│    └──────┘ └──────┘ └──────┘                            │  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
进程启动/退出
      │
      ▼
ProcessScanner (后台任务, 5s 间隔)
      │
      │ detected: Vec<String>
      ▼
AdapterRegistry.on_process_change(detected)
      │
      ├─ Auto 模式: resolve_adapter() → 激活最高优先级
      ├─ Manual 模式: 保持锁定不变
      │
      ▼
StateChangeEvent { adapter_id: Some("claude") }
      │
      ├─ 前端: 显示当前适配器图标/名称
      ├─ 托盘: 选中项打勾
      └─ 气泡: "已切换到 Claude Code"
```

### 2.3 三层控制

| 层级 | 触发方式 | 说明 |
|------|----------|------|
| **L1 自动发现** | 后台进程扫描 | 默认行为，检测到谁就用谁 |
| **L2 托盘切换** | 用户点击托盘菜单 | 切换到手动模式，锁定指定适配器 |
| **L3 前端切换** | 点击桌宠气泡/按钮 | 同 L2，但通过前端 UI 触发 |

---

## 三、分步实施方案

### 步骤 1: 将 AdapterRegistry 提升为全局可访问

**文件**: `src-tauri/src/main.rs` + `src-tauri/src/adapter_registry.rs`

**改动**:

```rust
// main.rs — 在 main() 中创建 Registry 后移出 spawn block

use std::sync::Arc;
use tokio::sync::RwLock;

// 改为 Arc 包装，以便多处共享
let registry = Arc::new(AdapterRegistry::new());

// 传递给 HTTP spawn
let reg_http = registry.clone();
tokio::spawn(async move {
    let app = http::create_router();
    let app = reg_http.merge_routes_into(app);
    // ...
});

// 传递给托盘
let reg_tray = registry.clone();
// 传递给后台扫描任务
let reg_scanner = registry.clone();
```

**验证**: `cargo build` 通过，HTTP 路由仍正常合并。

---

### 步骤 2: 后台进程扫描任务

**文件**: `src-tauri/src/main.rs` (新增 tokio::spawn)

```rust
// 后台任务：每 5 秒扫描进程 → 自动切换适配器
let reg_scanner = registry.clone();
let tx_scanner = tx.clone();  // broadcast sender
tokio::spawn(async move {
    loop {
        tokio::time::sleep(Duration::from_secs(5)).await;
        
        let prev = reg_scanner.get_active_adapter();
        let next = reg_scanner.scan_and_activate();
        
        if prev != next {
            match &next {
                Some(id) => {
                    let name = reg_scanner.adapter_name(id)
                        .unwrap_or("Unknown");
                    println!("[auto-switch] adapter changed: {:?} → '{}' ({})",
                        prev, id, name);
                    
                    // 通知前端适配器已切换
                    let _ = tx_scanner.send(StateChangeEvent {
                        animation: "waving".into(),
                        bubble: format!("已连接 {}~", name),
                        core_signal: "idle".into(),
                        tool_label: None,
                        overlay: None,
                        input_type: None,
                        options: None,
                    });
                }
                None => {
                    println!("[auto-switch] no adapter detected, all CLI processes stopped");
                }
            }
        }
    }
});
```

**验证**: 启动 Claude Code → 等 5s → 日志输出 `auto-switched active adapter to 'claude'`。

---

### 步骤 3: 托盘菜单集成

**文件**: `src-tauri/src/tray.rs`

**当前托盘菜单结构** (推断):
```
[Desktop Pet]
  ├─ 显示/隐藏
  ├─ 动画模式 (Sprite / GIF)
  ├─ ────────────
  └─ 退出
```

**改造后**:
```
[Desktop Pet]
  ├─ 显示/隐藏
  ├─ 动画模式 (Sprite / GIF)
  ├─ ────────────
  ├─ CLI 适配器
  │   ├─ ⬜ 自动检测         ← 选中时显示 ●
  │   ├─ ────────────
  │   ├─ ● Claude Code       ← 手动选择
  │   ├─ ⬜ Opencode
  │   ├─ ⬜ Copilot
  │   └─ ⬜ Trae
  ├─ ────────────
  └─ 退出
```

**实现要点**:
- 托盘 `setup()` 接收 `Arc<AdapterRegistry>` 参数
- 构建子菜单时调用 `registry.all_adapter_ids()` 枚举适配器
- 每个适配器项点击时调用 `registry.set_manual(id)`
- "自动检测" 项点击时调用 `registry.set_auto()`
- 菜单重建时机：适配器切换时通过 broadcast channel 通知托盘刷新

**改动签名**:
```rust
// tray.rs
pub fn setup(
    app: &mut tauri::App,
    registry: Arc<AdapterRegistry>,
) -> Result<(), Box<dyn std::error::Error>> {
    // ...
}
```

**验证**: 右键托盘 → CLI 适配器子菜单出现 → 点击 "Claude Code" → 模式切换为手动。

---

### 步骤 4: HTTP API 端点 — 适配器查询与控制

**文件**: `src-tauri/src/http.rs` (新增 3 个端点)

#### 4.1 获取适配器列表
```
GET /api/adapter/list
→ 200 {
    "adapters": [
      { "id": "claude", "name": "Claude Code", "enabled": true, "ready": true },
      { "id": "opencode", "name": "Opencode CLI", "enabled": true, "ready": false },
      ...
    ],
    "active": "claude",
    "mode": "auto"
  }
```

#### 4.2 获取当前活跃适配器
```
GET /api/adapter/active
→ 200 {
    "active": "claude",
    "mode": "auto",
    "detected": ["claude", "opencode"]
  }
```

#### 4.3 手动切换适配器
```
POST /api/adapter/switch
Body: { "id": "claude" }  或  { "mode": "auto" }
→ 200 { "ok": true, "active": "claude" }
→ 400 { "error": "adapter not found" }
```

**实现**: Handler 需要访问 Registry，因此 `AppState` 需要增加 `registry: Arc<AdapterRegistry>` 字段。

```rust
// http.rs — AppState 增加 registry 字段
#[derive(Clone)]
pub struct AppState {
    pub state: SharedState,
    pub tx: broadcast::Sender<StateChangeEvent>,
    pub pending_input: PendingInputSlot,
    pub claude_hwnd: Arc<std::sync::Mutex<isize>>,
    pub registry: Arc<AdapterRegistry>,  // ← 新增
}
```

**验证**: `curl http://127.0.0.1:9527/api/adapter/list` → 返回 JSON 含 4 个适配器。

---

### 步骤 5: 前端适配器状态展示

**文件**: `src/app.js`

#### 5.1 适配器状态面板（轻量气泡）

当前活跃适配器变化时，在桌宠旁边短暂显示适配器图标/名称：

```
┌─────────────────┐
│  🔌 Claude Code │  ← 2s 后自动消失
└─────────────────┘
   \
   🐱 (桌宠)
```

#### 5.2 实现

```javascript
// app.js — 新增适配器状态监听
window.addEventListener('state-change', (event) => {
    // 现有动画逻辑...
    
    // 适配器切换提示
    if (event.payload.adapter_id) {
        showAdapterBadge(event.payload.adapter_id);
    }
});
```

但当前 `StateChangeEvent` 不包含 `adapter_id` 字段。需要扩展：

```rust
// state.rs — StateChangeEvent 增加字段
pub struct StateChangeEvent {
    // ... 现有字段 ...
    pub adapter_id: Option<String>,   // ← 新增
    pub adapter_mode: Option<String>, // ← "auto" | "manual"
}
```

#### 5.3 点击桌宠弹出适配器选择

左键双击桌宠 → 弹出适配器选择气泡（利用现有输入气泡系统）:

```
┌────────────────────────┐
│ 选择 CLI 工具          │
│                        │
│ ● 自动检测             │
│ ○ Claude Code          │
│ ○ Opencode             │
│ ○ Copilot              │
│ ○ Trae                 │
│                        │
│         [取消]  [确认] │
└────────────────────────┘
```

选择后调用 `POST /api/adapter/switch`。

**验证**: 双击桌宠 → 弹出适配器选择 → 选择 "Claude Code" → 托盘菜单同步更新。

---

### 步骤 6: 适配器 Hooks 自动配置

**当前状态**: 仅 Claude Code 有 `write_claude_hooks_json()` 自动配置。

**目标**: 所有 4 个适配器都实现自动检测 + 自动配置。

#### 6.1 Claude Code（已有 ✅）
- 向上遍历找 `.claude/` 目录 → 写入/更新 `hooks.json`
- 用实际 HTTP 端口替换 `PORT` 占位符

#### 6.2 opencode（新增）
opencode 使用 TypeScript 插件（已实现 `plugins/opencode/desktop-pet.ts`）。
自动配置 = 检测 `opencode.json` 配置文件中是否有我们的插件引用，没有则提示。

```rust
// 新增: adapter_opencode.rs 中的 check_ready()
fn check_ready(&self) -> Result<bool, String> {
    // 检测 %USERPROFILE%/.config/opencode/opencode.json 中
    // plugins 数组是否包含 desktop-pet 插件
    // 或者检测 opencode 进程是否正在运行
    Ok(process_detector::detect_running_ai_clis()
        .iter()
        .any(|p| p == "opencode"))
}
```

#### 6.3 Copilot CLI（新增）
Copilot CLI 通过 HTTP hook 端点接收事件（已实现 `adapter_copilot.rs`）。
自动配置 = 检测 `%USERPROFILE%/.copilot/hooks.json` 是否存在。

#### 6.4 TRAE Work（新增）
TRAE Work 使用 PowerShell hook 脚本（已实现 `plugins/trae/hooks/`）。
自动配置 = 检测 TRAE Work 进程是否正在运行。

#### 6.5 统一自动配置入口

在 `AdapterRegistry` 或专门的后台任务中：

```rust
// 进程扫描任务中增加 hooks 自动配置检查
tokio::spawn(async move {
    loop {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let detected = reg_scanner.scan_and_activate();
        
        // 对每个检测到的适配器，触发其 hooks 配置
        for adapter_id in detected.iter().flatten() {
            if let Some(adapter) = reg_scanner.get(adapter_id) {
                match adapter.check_ready() {
                    Ok(true) => { /* hooks 已配置 */ }
                    Ok(false) => {
                        // 尝试自动配置 hooks
                        auto_configure_hooks(adapter);
                    }
                    Err(e) => eprintln!("check_ready error: {}", e),
                }
            }
        }
    }
});
```

**验证**: 首次启动 → 检测到 Claude Code 进程 → 自动创建 `.claude/hooks.json`。

---

### 步骤 7: 生命周期与崩溃恢复

#### 7.1 适配器失活处理

当一个适配器的 CLI 进程退出后：

```
1. ProcessScanner 检测到进程缺失
2. on_process_change() 发现候选列表为空
3. Auto 模式下 active_adapter 设为 None
4. 如果有其他适配器进程在运行 → 切换到次高优先级
5. 如果没有任何 CLI 进程 → 宠物回到 Idle，提示 "未检测到 CLI 工具"
```

#### 7.2 适配器路由不可达容错

当 HTTP hook 请求进入但对应适配器未激活时，返回 503：

```rust
// 新增: 自适应路由守卫 (middleware)
// 当请求 /api/claude/* 但 claude 适配器未激活时 → 仍然处理，
// 因为即使不是 "当前激活" 适配器，它的 CLI 进程可能仍在发送事件。
// 
// 策略：不拦截请求，所有适配器路由始终可用。
// "激活" 仅影响前端显示和气泡切换提示，不影响路由。
```

> **关键设计决策**: 所有适配器路由始终开放，不分"激活"与否。这样即使优先级仲裁选错了，
> 其他 CLI 的事件也不会丢失。"激活"只影响 UI 展示。

#### 7.3 HTTP 服务崩溃恢复

```rust
// main.rs — graceful shutdown 处理
tokio::spawn(async move {
    let app = /* ... */;
    axum::serve(http_listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
        })
        .await
        .unwrap_or_else(|e| eprintln!("HTTP server error: {}", e));
});
```

---

### 步骤 8: 性能基准测试

**文件**: 新增 `src-tauri/tests/benchmark.rs`（或使用脚本）

| 指标 | 目标 | 测试方法 |
|------|------|----------|
| HTTP 请求延迟 | <50ms (p99) | `wrk` / `oha` 发 1000 请求到 `/api/heartbeat` |
| MCP 请求延迟 | <100ms (p99) | `echo '{"jsonrpc":"2.0",...}' | nc 127.0.0.1 9528` |
| 进程扫描开销 | <10ms | 测量 `detect_running_ai_clis()` 执行时间 |
| 状态切换延迟 | <5ms | 测量 hook 事件 → frontend event 的全链路时间 |

```bash
# 简单基准测试脚本
echo "=== HTTP Latency Benchmark ==="
oha -n 1000 -c 10 http://127.0.0.1:9527/api/heartbeat

echo "=== Process Detection Benchmark ==="
# 在 Rust 测试中:
# #[bench]
# fn bench_detect_processes(b: &mut Bencher) {
#     b.iter(|| process_detector::detect_running_ai_clis());
# }
```

**验证**: HTTP p99 < 50ms，进程扫描 < 10ms。

---

## 四、完整改动清单

| # | 文件 | 改动类型 | 行数估计 | 优先级 |
|---|------|----------|----------|--------|
| 1 | `main.rs` | Registry 提升为 Arc + 传递给 tray/scanner/frontend | +30/-10 | P0 |
| 2 | `main.rs` | 新增 ProcessScanner 后台任务 | +25 | P0 |
| 3 | `main.rs` | 新增 hooks 自动配置后台任务 | +30 | P1 |
| 4 | `tray.rs` | 新增 CLI 适配器子菜单 | +60 | P0 |
| 5 | `http.rs` | AppState 增加 registry 字段 | +5 | P0 |
| 6 | `http.rs` | 新增 /api/adapter/* 端点 | +60 | P0 |
| 7 | `state.rs` | StateChangeEvent 增加 adapter_id/adapter_mode | +4 | P1 |
| 8 | `adapter_registry.rs` | 无需改动（已完备） | 0 | — |
| 9 | `adapter_trait.rs` | 新增 auto_configure_hooks 默认方法 | +10 | P2 |
| 10 | `adapter_claude.rs` | check_ready 增强 | +5 | P2 |
| 11 | `adapter_opencode.rs` | check_ready 增强 | +5 | P2 |
| 12 | `adapter_copilot.rs` | check_ready 增强 | +5 | P2 |
| 13 | `adapter_trae.rs` | check_ready 增强 | +5 | P2 |
| 14 | `process_detector.rs` | 无需改动（已完备） | 0 | — |
| 15 | `app.js` | 适配器状态气泡 + 双击选择适配器 | +50 | P1 |
| 16 | `bubble.js` | 无需改动（已支持选择气泡） | 0 | — |
| 17 | 新增 `tests/benchmark.rs` | 性能基准测试 | +40 | P2 |
| 18 | `tauri.conf.json` | 如有需要，更新窗口标题 | 0 | — |

**总计**: ~340 行改动，分布在 12 个文件中。核心改动在 `main.rs` (约 85 行) 和 `tray.rs` (约 60 行)。

---

## 五、实施顺序与估时

| 步骤 | 内容 | 估时 | 依赖 |
|------|------|------|------|
| Day 1 上午 | 步骤 1: Registry 提升为 Arc + 步骤 2: ProcessScanner | 2h | — |
| Day 1 下午 | 步骤 3: 托盘菜单集成 | 2h | 步骤 1 |
| Day 2 上午 | 步骤 4: HTTP API 端点 + AppState 扩展 | 2h | 步骤 1 |
| Day 2 下午 | 步骤 5: 前端适配器状态展示 | 2h | 步骤 4 |
| Day 3 上午 | 步骤 6: Hooks 自动配置完善 | 2h | 步骤 2 |
| Day 3 下午 | 步骤 7: 生命周期 + 崩溃恢复 + 步骤 8: 基准测试 | 3h | 全部 |
| Day 4 | 联调 + 验收 | 3h | 全部 |

**总工期**: 4 个工作日（约 16 小时）

---

## 六、验收标准

### 6.1 自动化验收

- [ ] 启动桌宠 → 启动 Claude Code → 等 ≤5s → 桌宠状态栏显示 "Claude Code"
- [ ] 关闭 Claude Code → 等 ≤5s → 桌宠恢复 "未检测到 CLI 工具"
- [ ] 同时运行 Claude Code + opencode → 自动选择 Claude Code（优先级更高）
- [ ] 关闭 Claude Code（仅剩 opencode）→ 自动切换到 opencode
- [ ] 托盘菜单 → CLI 适配器 → 手动选择 "Copilot" → 即使 Claude Code 在运行也不切换
- [ ] 托盘菜单 → CLI 适配器 → 选择 "自动检测" → 立即切回 Claude Code（如果正在运行）
- [ ] `curl /api/adapter/list` → 返回 4 个适配器 + 当前活跃 + 模式
- [ ] `curl -X POST /api/adapter/switch -d '{"mode":"auto"}'` → 返回 200
- [ ] 双击桌宠 → 弹出适配器选择气泡 → 选择后托盘菜单同步更新
- [ ] 首次运行 `.claude/hooks.json` 已自动创建且端口正确
- [ ] HTTP /api/heartbeat p99 < 50ms
- [ ] MCP initialize p99 < 100ms

### 6.2 负面场景

- [ ] 适配器进程崩溃：宠物不崩溃，自行回到 Idle
- [ ] HTTP 端口全被占用：日志警告但程序不 panic
- [ ] 两个 CLI 工具同时频繁启动/停止：状态不震荡（依赖现有 800ms 防抖）
- [ ] 用户在手动模式下关闭了锁定的 CLI：宠物提示 "CLI 工具已关闭" 但不自动切换

---

## 七、风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| Arc 循环引用 | 低 | Registry → adapters 是单向持有；Registry 不持有 Tray/Scanner |
| 托盘菜单重建性能 | 低 | 只在适配器切换时重建，频率 <1次/5秒 |
| ProcessScanner CPU 开销 | 低 | CreateToolhelp32Snapshot 本身轻量；5s 间隔足够稀疏 |
| 前端适配器 UI 与现有气泡系统冲突 | 中 | 适配器选择复用现有 `pet_ask` 选择气泡；切换提示用新的 2s 短气泡类型 |
| `AppState` 增加字段导致所有 handler 签名变更 | **无** | `AppState` 是 `Clone` 的，增加字段不影响现有 handler（通过 `State(app)` 自动注入） |

---

## 八、架构决策记录 (ADR)

### ADR-001: 适配器路由始终开放

**决策**: 所有适配器的 HTTP 路由始终可用，不因"非活跃"而拦截请求。

**理由**:
1. CLI 工具可能同时运行多个（比如同时开 Claude Code 和 opencode）
2. "激活"只是 UI 展示概念，不影响事件接收
3. 拦截请求会导致事件丢失，修复成本高于收益

**替代方案（已拒绝）**: 在 HTTP 中间件层拦截非活跃适配器的请求 → 返回 503。
拒绝原因：可能丢失真实事件。

### ADR-002: ProcessScanner 使用固定 5s 间隔

**决策**: 进程扫描间隔固定 5 秒，不做自适应调整。

**理由**:
1. 足够快：用户不会感知 5s 的切换延迟
2. 足够省：CreateToolhelp32Snapshot 开销可忽略
3. 简单：无需实现动态间隔算法

**替代方案（已拒绝）**: 监听进程创建/销毁事件（WMI 事件订阅）。
拒绝原因：实现复杂，需要额外的 Windows API 调用和 COM 初始化，收益不大。

### ADR-003: 手动模式不自动恢复

**决策**: 用户手动选择适配器后，即使该 CLI 退出也不会自动切回自动模式。

**理由**:
1. 用户行为是显式的，应尊重用户选择
2. 避免"我选了 Copilot，但系统自动切回 Claude Code"的困惑
3. 用户可以随时通过菜单切回自动模式

**替代方案（已拒绝）**: 手动锁定的 CLI 退出后自动切回自动模式。
拒绝原因：违反了"手动选择应保持稳定"的原则。

---

## 九、后续扩展（Phase 4+）

完成本集成方案后，Phase 4 可在此基础上添加：

1. **适配器插件系统**: 让第三方通过配置文件注册新的 CLI 适配器（无需修改 Rust 代码）
2. **适配器统计**: 记录每个适配器的使用时长、触发次数，用于优化优先级
3. **跨平台进程检测**: macOS `/proc` 扫描、Linux `pgrep` 方案
4. **WebSocket 推送**: 替代 HTTP hook，实现更实时的双向通信
5. **适配器健康检查**: 定期 ping 适配器的 CLI 进程，检测假死

---

## 十、总结

本集成方案解决的核心问题是**连接器缺失**——现有模块（Registry、适配器、进程检测、托盘）
都已独立实现，但缺乏将它们串起来的胶水代码。

方案通过三个关键改动实现完全集成：

1. **Registry 全局化**（Arc 共享）— 打破 spawn block 的作用域限制
2. **ProcessScanner 后台任务** — 弥补"有检测函数但无人调用"的缺口
3. **托盘 + 前端 UI** — 提供用户可感知的适配器控制入口

实施后，桌宠将实现：
- **自动感知**正在使用的 CLI 工具并切换动画/气泡
- **手动锁定**指定 CLI 工具
- **前端 + 托盘**双通道控制适配器
- **Hooks 自动部署**到检测到的 CLI 工具
