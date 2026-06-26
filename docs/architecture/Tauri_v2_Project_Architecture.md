# Desktop Pet - Tauri v2 项目架构设计

## 1. 项目概述

**项目名称**: Desktop Pet  
**框架**: Tauri v2  
**目标平台**: Windows  
**核心功能**: 桌面宠物应用，支持透明/无边框/置顶窗口、系统托盘、自动移动

---

## 2. 项目目录结构

```
Desktop_Pet/
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml               # 依赖管理
│   ├── tauri.conf.json         # Tauri 配置
│   ├── build.rs                # 构建脚本
│   ├── capabilities/           # 权限配置
│   │   └── default.json
│   ├── icons/                  # 图标资源
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   └── tray-icon.png
│   └── src/
│       ├── main.rs             # 程序入口
│       ├── lib.rs              # 库入口
│       ├── commands/           # Tauri 命令
│       │   ├── mod.rs
│       │   ├── window.rs       # 窗口控制
│       │   └── state.rs        # 状态管理
│       ├── window/             # 窗口管理
│       │   ├── mod.rs
│       │   └── click_through.rs
│       ├── tray/               # 系统托盘
│       │   ├── mod.rs
│       │   └── menu.rs
│       ├── movement/           # 移动引擎
│       │   ├── mod.rs
│       │   └── path.rs
│       ├── state/              # 状态机
│       │   ├── mod.rs
│       │   └── pet_state.rs
│       └── config/             # 配置管理
│           └── mod.rs
├── src/                         # 前端资源
│   ├── index.html
│   ├── styles.css
│   └── scripts/
│       └── app.js
├── package.json
└── SPEC.md
```

---

## 3. 核心配置文件

### 3.1 Cargo.toml

```toml
[package]
name = "desktop-pet"
version = "0.1.0"
edition = "2021"
description = "A desktop pet that stays on your screen"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
once_cell = "1"

# Windows 特定依赖
[target.'cfg(windows)'.dependencies]
winapi = { version = "0.3", features = ["winuser", "minwindef", "windef", "handleapi"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

### 3.2 tauri.conf.json

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "Desktop Pet",
  "version": "0.1.0",
  "identifier": "com.desktop-pet.app",
  "build": {
    "frontendDist": "../src",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Desktop Pet",
        "width": 192,
        "height": 255,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "resizable": false,
        "skipTaskbar": true,
        "shadow": false,
        "focus": false,
        "visible": true,
        "minWidth": 192,
        "minHeight": 255,
        "maxWidth": 192,
        "maxHeight": 255
      }
    ],
    "trayIcon": {
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": false
    },
    "security": {
      "csp": null
    }
  }
}
```

### 3.3 build.rs

```rust
fn main() {
    tauri_build::build()
}
```

### 3.4 capabilities/default.json

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-utils/schema.json",
  "identifier": "default",
  "description": "Default capabilities for the desktop pet",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-start-dragging",
    "core:window:allow-hide",
    "core:window:allow-show",
    "core:window:allow-set-position",
    "core:window:allow-outer-position",
    "core:window:allow-set-size",
    "core:app:default",
    "store:default"
  ]
}
```

---

## 4. Rust 源码模块设计

### 4.1 lib.rs - 库入口

```rust
pub mod commands;
pub mod config;
pub mod movement;
pub mod state;
pub mod tray;
pub mod window;

pub use commands::*;
pub use config::Config;
pub use state::{PetState, StateManager};
```

### 4.2 main.rs - 程序入口

```rust
#![windows_subsystem = "windows"]

mod commands;
mod config;
mod movement;
mod state;
mod tray;
mod window;

use std::sync::Arc;
use tokio::sync::{broadcast, Mutex as TokioMutex};
use tauri::{Manager, Emitter};

use crate::state::{StateManager, StateChangeEvent};
use crate::movement::MovementEngine;

#[tokio::main]
async fn main() {
    // 初始化状态管理
    let state_manager = Arc::new(TokioMutex::new(StateManager::new()));
    let (tx, _rx) = broadcast::channel::<StateChangeEvent>(32);

    tauri::Builder::default()
        .manage(state_manager.clone())
        .manage(tx.clone())
        .invoke_handler(tauri::generate_handler![
            commands::window::start_drag,
            commands::window::hide_window,
            commands::window::show_window,
            commands::window::exit_app,
            commands::state::get_state,
            commands::state::set_state,
            commands::state::get_position,
            commands::state::set_position,
        ])
        .setup(|app| {
            // 初始化窗口 HWND
            // 初始化系统托盘
            // 启动移动引擎
            // 发送初始状态
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Desktop Pet");
}
```

### 4.3 commands/mod.rs

```rust
pub mod window;
pub mod state;
```

### 4.4 commands/window.rs

```rust
use tauri::{Window, AppHandle};

// 开始拖动窗口
#[tauri::command]
pub fn start_drag(window: Window) {
    let _ = window.start_dragging();
}

// 隐藏窗口
#[tauri::command]
pub fn hide_window(window: Window) {
    let _ = window.hide();
}

// 显示窗口
#[tauri::command]
pub fn show_window(window: Window) {
    let _ = window.show();
}

// 退出应用
#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}
```

### 4.5 commands/state.rs

```rust
use tauri::{Manager, State};
use crate::state::{StateManager, PetState};

// 获取当前状态
#[tauri::command]
pub async fn get_state(
    state: State<'_, Arc<TokioMutex<StateManager>>>,
) -> Result<PetState, String> {
    let mgr = state.lock().await;
    Ok(mgr.current_state())
}

// 设置状态
#[tauri::command]
pub async fn set_state(
    new_state: PetState,
    state: State<'_, Arc<TokioMutex<StateManager>>>,
    tx: State<'_, broadcast::Sender<StateChangeEvent>>,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.set_state(new_state);
    drop(mgr);
    Ok(())
}

// 获取窗口位置
#[tauri::command]
pub async fn get_position(
    window: tauri::Window,
) -> Result<(i32, i32), String> {
    window.outer_position()
        .map(|p| (p.x, p.y))
        .map_err(|e| e.to_string())
}

// 设置窗口位置
#[tauri::command]
pub async fn set_position(
    x: i32,
    y: i32,
    window: tauri::Window,
) -> Result<(), String> {
    window.set_position(tauri::Position::Physical(
        tauri::PhysicalPosition::new(x, y)
    )).map_err(|e| e.to_string())
}
```

### 4.6 state/pet_state.rs

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PetState {
    Idle,
    Walking,
    Running,
    Sleeping,
    Jumping,
    Waving,
}

impl PetState {
    pub fn animation_name(&self) -> &'static str {
        match self {
            PetState::Idle => "idle",
            PetState::Walking => "walk",
            PetState::Running => "run",
            PetState::Sleeping => "sleep",
            PetState::Jumping => "jump",
            PetState::Waving => "wave",
        }
    }
}
```

### 4.7 state/mod.rs

```rust
pub mod pet_state;

pub use pet_state::PetState;

#[derive(Clone, serde::Serialize)]
pub struct StateChangeEvent {
    pub state: PetState,
    pub animation: String,
    pub bubble: Option<String>,
}

pub struct StateManager {
    current: PetState,
}

impl StateManager {
    pub fn new() -> Self {
        Self {
            current: PetState::Idle,
        }
    }

    pub fn current_state(&self) -> PetState {
        self.current.clone()
    }

    pub fn set_state(&mut self, state: PetState) {
        self.current = state;
    }
}
```

### 4.8 window/click_through.rs (Windows)

```rust
#[cfg(windows)]
use winapi::um::winuser::{
    GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE,
    WS_EX_TRANSPARENT, WS_EX_LAYERED,
};

#[cfg(windows)]
pub unsafe fn enable_click_through(hwnd: isize) {
    let hwnd = hwnd as *mut std::ffi::c_void;
    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_TRANSPARENT as isize);
}

#[cfg(windows)]
pub unsafe fn disable_click_through(hwnd: isize) {
    let hwnd = hwnd as *mut std::ffi::c_void;
    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style & !(WS_EX_TRANSPARENT as isize));
}

#[cfg(not(windows))]
pub fn enable_click_through(_hwnd: isize) {}

#[cfg(not(windows))]
pub fn disable_click_through(_hwnd: isize) {}
```

### 4.9 tray/mod.rs

```rust
pub mod menu;

use tauri::{
    AppHandle, Runtime,
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    menu::{Menu, MenuItem},
};

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Desktop Pet")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "quit" => app.exit(0),
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
```

### 4.10 movement/mod.rs

```rust
pub mod path;

use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio::time::{sleep, Duration};

pub struct MovementEngine {
    hwnd: isize,
    x: f64,
    y: f64,
    mode: MovementMode,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MovementMode {
    FreeRoam,    // 自由漫游
    ScreenEdge,  // 贴边移动
    FollowMouse, // 跟随鼠标
    Manual,      // 手动控制
}

impl MovementEngine {
    pub fn new(hwnd: isize, x: f64, y: f64) -> Self {
        Self {
            hwnd,
            x,
            y,
            mode: MovementMode::FreeRoam,
        }
    }

    pub async fn start(
        mut self,
        mut rx: broadcast::Receiver<super::StateChangeEvent>,
    ) {
        loop {
            tokio::select! {
                _ = rx.recv() => {
                    // 处理状态变化事件
                }
                _ = sleep(Duration::from_secs(5)) => {
                    // 自动移动逻辑
                    self.tick().await;
                }
            }
        }
    }

    async fn tick(&mut self) {
        match self.mode {
            MovementMode::FreeRoam => {
                // 随机移动
            }
            MovementMode::ScreenEdge => {
                // 屏幕边缘移动
            }
            _ => {}
        }
        self.apply_position().await;
    }

    async fn apply_position(&mut self) {
        #[cfg(windows)]
        unsafe {
            use winapi::um::winuser::SetWindowPos;
            use winapi::um::winuser::SWP_NOZORDER;
            use winapi::shared::windef::HWND_TOP;

            SetWindowPos(
                self.hwnd as *mut std::ffi::c_void,
                HWND_TOP,
                self.x as i32,
                self.y as i32,
                0,
                0,
                SWP_NOZORDER,
            );
        }
    }
}
```

### 4.11 config/mod.rs

```rust
use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub window_position: Option<WindowPosition>,
    pub movement_mode: String,
    pub click_through: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            window_position: None,
            movement_mode: "free_roam".to_string(),
            click_through: false,
        }
    }
}

impl Config {
    pub fn load(app: &tauri::AppHandle) -> Self {
        // 从 store 加载配置
        todo!()
    }

    pub fn save(&self, app: &tauri::AppHandle) {
        // 保存到 store
        todo!()
    }
}
```

---

## 5. 前端资源

### 5.1 src/index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Desktop Pet</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="pet-container">
        <img id="pet-sprite" src="assets/pet.png" alt="Desktop Pet">
        <div id="bubble" class="hidden"></div>
    </div>
    <script src="scripts/app.js"></script>
</body>
</html>
```

### 5.2 src/styles.css

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
    user-select: none;
    -webkit-user-select: none;
}

#pet-container {
    position: fixed;
    width: 192px;
    height: 255px;
    cursor: move;
    image-rendering: pixelated;
}

#pet-sprite {
    width: 100%;
    height: 100%;
}

#bubble {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    white-space: nowrap;
}

#bubble::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-top-color: white;
}

#bubble.hidden {
    display: none;
}
```

### 5.3 src/scripts/app.js

```javascript
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

class DesktopPet {
    constructor() {
        this.currentState = 'idle';
        this.init();
    }

    async init() {
        // 监听状态变化事件
        await listen('state-change', (event) => {
            this.onStateChange(event.payload);
        });

        // 设置拖动
        document.getElementById('pet-container').addEventListener('mousedown', () => {
            invoke('start_drag');
        });

        // 双击隐藏
        document.getElementById('pet-container').addEventListener('dblclick', () => {
            invoke('hide_window');
        });
    }

    onStateChange(payload) {
        this.currentState = payload.state;
        // 更新动画
        // 显示气泡
    }
}

new DesktopPet();
```

---

## 6. 窗口配置说明

### 6.1 核心窗口属性

| 属性 | 值 | 说明 |
|------|------|------|
| `decorations` | `false` | 无窗口边框和标题栏 |
| `transparent` | `true` | 窗口背景透明 |
| `alwaysOnTop` | `true` | 窗口置顶 |
| `skipTaskbar` | `true` | 隐藏任务栏图标 |
| `shadow` | `false` | 禁用窗口阴影 |
| `resizable` | `false` | 禁用窗口缩放 |
| `focus` | `false` | 不获取焦点 |
| `visible` | `true` | 启动时显示 |

### 6.2 窗口尺寸

- **默认尺寸**: 192 x 255 像素（适配宠物精灵图）
- **最小/最大**: 固定为 192 x 255

### 6.3 点击穿透实现

通过 Windows API 操作窗口扩展样式：
- `WS_EX_TRANSPARENT`: 启用点击穿透
- 使用 `GetWindowLongPtr` / `SetWindowLongPtr` 修改

---

## 7. 状态机设计

```
     ┌──────────────────────────────────────────────┐
     │                                              │
     ▼                                              │
  ┌──────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐
  │ Idle │───▶│ Walking │───▶│ Running  │───▶│ Jumping  │
  └──┬───┘    └────┬────┘    └────┬─────┘    └──────────┘
     │             │              │
     │             │              │
     │         (60s idle)         │
     │             │              │
     │             ▼              │
     │        ┌──────────┐        │
     └───────▶│ Sleeping │◀───────┘
              └──────────┘
                   ▲
                   │
              (interaction)
                   │
                   └───────────────▶ Waving
```

### 状态转换规则

| 当前状态 | 触发条件 | 下一状态 | 动画 |
|----------|----------|----------|------|
| Idle | 任意交互 | Waving | wave |
| Idle | 60s 无操作 | Sleeping | sleep |
| Walking | 快速移动 | Running | run |
| Sleeping | 任意操作 | Idle | idle |
| Waving | 5s 后 | Idle | idle |
| Running | 30s 后 | Idle | idle |

---

## 8. 移动引擎设计

### 8.1 移动模式

1. **FreeRoam (自由漫游)**
   - 随机方向移动
   - 每 5-10 秒改变方向
   - 遇到屏幕边缘反弹

2. **ScreenEdge (贴边移动)**
   - 沿屏幕边缘移动
   - 检测窗口位置避免越界

3. **FollowMouse (跟随鼠标)**
   - 缓慢跟随鼠标位置
   - 平滑移动插值

4. **Manual (手动控制)**
   - 禁用自动移动
   - 仅响应用户拖动

### 8.2 移动参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `tick_interval_ms` | 50ms | 移动更新间隔 |
| `speed_idle` | 2px/tick | 待机移动速度 |
| `speed_walk` | 5px/tick | 行走移动速度 |
| `speed_run` | 10px/tick | 奔跑移动速度 |
| `edge_padding` | 50px | 屏幕边缘留白 |

---

## 9. 系统托盘设计

### 9.1 托盘菜单

```
┌─────────────────┐
│  🏠 Show        │ 显示窗口
│  👁 Hide        │ 隐藏窗口
├─────────────────┤
│  🚶 FreeRoam    │ 移动模式 ▶
│  📌 ScreenEdge  │
│  🐭 FollowMouse │
│  ✋ Manual      │
├─────────────────┤
│  ❌ Quit        │ 退出应用
└─────────────────┘
```

### 9.2 托盘图标

- **文件**: `icons/tray-icon.png`
- **尺寸**: 32x32 像素
- **格式**: PNG（支持透明）

---

## 10. 依赖版本说明

### 10.1 Tauri v2 特性

| 特性 | 启用方式 | 用途 |
|------|----------|------|
| `tray-icon` | `tauri = { features = ["tray-icon"] }` | 系统托盘 |
| `custom-protocol` | `[features]` | 启用 WebView2 |

### 10.2 插件依赖

| 插件 | 版本 | 用途 |
|------|------|------|
| `tauri-plugin-store` | 2 | 本地配置存储 |

### 10.3 运行时依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `tokio` | 1 | 异步运行时 |
| `serde` | 1 | 数据序列化 |
| `winapi` | 0.3 | Windows API 调用 |

---

## 11. 构建与运行

### 11.1 开发模式

```bash
cd src-tauri
cargo tauri dev
```

### 11.2 生产构建

```bash
cd src-tauri
cargo tauri build
```

### 11.3 输出目录

- Windows: `src-tauri/target/release/desktop-pet.exe`
- 图标: `src-tauri/icons/`

---

## 12. 扩展功能预留

以下功能可在基础架构上扩展：

1. **多宠物支持** - 通过 `label` 管理多个窗口
2. **动作系统** - 精灵动画帧切换
3. **对话气泡** - 与用户交互
4. **声音系统** - 背景音乐和音效
5. **HTTP API** - 与 AI 助手集成
6. **MCP 支持** - AI 助手控制接口

---

*文档版本: 1.0.0*  
*更新日期: 2026-06-26*
