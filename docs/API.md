# Desktop Pet API Documentation

> Version: 0.1.0 — Phase 1  
> Last updated: 2026-06-17

---

## Table of Contents

1. [PetState Enum](#petstate-enum)
2. [StateManager](#statemanager)
3. [HTTP API](#http-api)
4. [MCP API](#mcp-api)
5. [Tauri IPC Commands](#tauri-ipc-commands)

---

## PetState Enum

Defined in `src-tauri/src/state.rs`, the `PetState` enum represents all possible states of the desktop pet. Each state maps to an animation, a core signal layer, an optional overlay, and a bubble message.

### States

| # | State | Animation | Core Signal | Overlay | Bubble Text | Description |
|---|-------|-----------|-------------|---------|-------------|-------------|
| 1 | `Idle` | `idle` | `idle` | `None` | `""` (empty) | Default resting state. No activity. |
| 2 | `Thinking` | `waiting` | `waiting` | `None` | `""` (empty) | Claude Code is processing a prompt. |
| 3 | `Running` | `running` | `running` | `None` | Varies by tool (see below) | A tool is executing (Read, Write, Bash, etc.). |
| 4 | `Review` | `review` | `ready` | `None` | `"搞定!"` (Done!) | Task completed, awaiting user review. |
| 5 | `Failed` | `failed` | `idle` | `error` | `"好像出问题了..."` (Something went wrong) | An error occurred during execution. |
| 6 | `Waving` | `waving` | `idle` | `None` | `"桌宠已上线~"` (Pet is online~) | Greeting animation on startup. |
| 7 | `Jumping` | `jumping` | `idle` | `None` | `""` (empty) | Happy/jumping animation (idle variant). |
| 8 | `Chatting` | `chatting` | `running` | `None` | `"正在组织回复..."` (Organizing reply...) | LLM is generating a response. |
| 9 | `Fetching` | `fetching` | `running` | `None` | `"正在获取网络内容..."` (Fetching web content) | Fetching external web resources. |
| 10 | `Searching` | `searching` | `running` | `None` | `"正在搜索网络..."` (Searching the web) | Performing a web search. |
| 11 | `Analyzing` | `analyzing` | `running` | `None` | `"正在分析..."` (Analyzing...) | Analyzing code or data. |
| 12 | `Building` | `building` | `running` | `None` | `"正在构建..."` (Building...) | Building/compiling project. |
| 13 | `Celebrating` | `celebrating` | `ready` | `None` | `"太棒了!"` (Awesome!) | Success celebration animation. |
| 14 | `Permission` | `waving` | `waiting` | `permission` | `"等待指示..."` (Waiting for instructions) | Awaiting user permission/input. |
| 15 | `Sleeping` | `sleeping` | `idle` | `sleep` | `"zzz..."` | Pet is asleep (inactive for extended period). |

### State Transitions

```
         ┌────────────────────────────────────────────┐
         │                                            │
         ▼                                            │
     ┌──────┐    ┌──────────┐    ┌───────────┐        │
     │ Idle │◄───│ Thinking │───▶│  Running  │        │
     └──┬───┘    └──────────┘    └─────┬─────┘        │
        │                              │              │
        │                    ┌─────────┼─────────┐    │
        │                    │         │         │    │
        ▼                    ▼         ▼         ▼    │
   ┌────────┐          ┌────────┐ ┌────────┐ ┌────────┐│
   │ Waving │          │Chatting│ │Fetching│ │Searchng││
   ├────────┤          ├────────┤ ├────────┤ ├────────┤│
   │Jumping │          │Analyze │ │Building│ │        ││
   └───┬────┘          └────────┘ └────────┘ └────────┘│
       │                                                │
       ▼                                                │
   ┌────────┐    ┌──────────┐    ┌──────────────┐      │
   │ Sleep  │───▶│Celebrate │───▶│   Review     │      │
   └────────┘    └──────────┘    └──────┬───────┘      │
                                        │              │
                                        ▼              │
                                   ┌────────┐         │
                                   │ Failed │         │
                                   ├────────┤         │
                                   │Permission│───────┘
                                   └────────┘
```

**Notes:**
- `Running` branches to tool-specific substates (`Chatting`, `Fetching`, `Searching`, `Analyzing`, `Building`) based on the tool name.
- `Waving` and `Jumping` are transient idle animations.
- `Sleeping` auto-activates after a period of `Idle`; any non-idle signal wakes the pet.
- `Permission` waits for user interaction, then returns to the previous active state.
- `Failed` and `Review` are terminal states for a task cycle, returning to `Idle`.

### Tool-Specific Bubble Texts (Running state)

| Tool | Bubble Text |
|------|-------------|
| `Read`, `Glob`, `Grep` | `"正在读取文件..."` (Reading files...) |
| `Write`, `Edit` | `"正在写代码..."` (Writing code...) |
| `Bash` | `"正在执行命令..."` (Executing command...) |
| `Agent`, `Task` | `"正在调度子任务..."` (Scheduling subtasks...) |
| `WebFetch` | `"正在获取网络内容..."` (Fetching web content...) |
| `WebSearch` | `"正在搜索网络..."` (Searching the web...) |
| *(other/unknown)* | `"工作中..."` (Working...) |

---

## StateManager

Defined in `src-tauri/src/state.rs`.

```rust
pub struct StateManager {
    current: PetState,
    current_tool: Option<String>,
    history: Vec<StateRecord>,
    pub last_transition: u64,      // ms since UNIX epoch
    pub pending_messages: Vec<String>,
}
```

### Constructor

```rust
pub fn new() -> Self
```

Creates a new `StateManager` initialized to `PetState::Idle` with no tool, empty history, and no pending messages.

### Methods

#### `set_state`
```rust
pub fn set_state(&mut self, state: PetState, tool: Option<String>)
```
Sets the current pet state and optional tool name. Records the transition in history (max 50 entries). Updates `last_transition` to the current timestamp in milliseconds.

#### `current_state`
```rust
pub fn current_state(&self) -> &PetState
```
Returns a reference to the current state.

#### `current_tool`
```rust
pub fn current_tool(&self) -> Option<&str>
```
Returns the currently active tool name, if any.

#### `history`
```rust
pub fn history(&self) -> &Vec<StateRecord>
```
Returns a reference to the full state transition history.

#### `should_keep_running`
```rust
pub fn should_keep_running(&self, min_ms: u64) -> bool
```
Returns `true` if the current state is an active/running state AND less than `min_ms` milliseconds have elapsed since the last transition. Used to debounce rapid state changes.

**Active states**: `Running`, `Chatting`, `Fetching`, `Searching`, `Analyzing`, `Building`

#### `push_message`
```rust
pub fn push_message(&mut self, msg: String)
```
Appends a user message to the pending messages queue.

#### `drain_messages`
```rust
pub fn drain_messages(&mut self) -> Vec<String>
```
Drains and returns all pending user messages.

### Supporting Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateRecord {
    pub state: PetState,
    pub tool: Option<String>,
    pub timestamp: u64,        // seconds since UNIX epoch
}

#[derive(Debug, Clone, Serialize)]
pub struct StateChangeEvent {
    pub animation: String,
    pub bubble: String,
    pub core_signal: String,
    pub tool_label: Option<String>,
    pub overlay: Option<String>,
    pub input_type: Option<String>,
    pub options: Option<Vec<String>>,
}

#[derive(Debug)]
pub struct PendingInput {
    pub tx: oneshot::Sender<String>,
    pub input_type: String,
    pub options: Option<Vec<String>>,
}
```

### Type Aliases

```rust
pub type SharedState = Arc<Mutex<StateManager>>;
pub type PendingInputSlot = Arc<Mutex<Option<PendingInput>>>;
```

### State Change Events

State changes are broadcast via a `tokio::sync::broadcast` channel. The event payload is a `StateChangeEvent` with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `animation` | `String` | Animation name to play (e.g., `"idle"`, `"running"`, `"waiting"`) |
| `bubble` | `String` | Text to display in the speech bubble |
| `core_signal` | `String` | Core activity signal: `"idle"`, `"waiting"`, `"running"`, or `"ready"` |
| `tool_label` | `Option<String>` | Currently active tool name (if any) |
| `overlay` | `Option<String>` | Overlay type: `"permission"`, `"error"`, `"sleep"`, or `None` |
| `input_type` | `Option<String>` | Input type for pending input: `"text"`, `"confirm"`, `"select"` |
| `options` | `Option<Vec<String>>` | Available options for `"select"` input type |

---

## HTTP API

Defined in `src-tauri/src/http.rs`. Runs on the Tauri embedded HTTP server. CORS is enabled for all origins, methods, and headers.

**Base URL**: `http://localhost:{port}` (port configured at runtime — check Tauri logs for the actual port).

### Endpoints

---

#### `POST /api/state`

Set the pet state by hook name (used by Claude Code hooks).

**Request Body:**
```json
{
  "s": "thinking",
  "tool": "Read"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `s` | `string` | Yes | State hook name (see mapping below) |
| `tool` | `string` | No | Tool name for context-aware bubble text |

**Hook Name → PetState Mapping:**

| Hook Value | PetState |
|------------|----------|
| `"thinking"` | `Thinking` |
| `"working"` | `Running` |
| `"done"` | `Review` |
| `"idle"` | `Idle` |
| `"error"` | `Failed` |
| `"jumping"` | `Jumping` |
| `"waving"` | `Waving` |
| `"chatting"` | `Chatting` |
| `"fetching"` | `Fetching` |
| `"searching"` | `Searching` |
| `"analyzing"` | `Analyzing` |
| `"building"` | `Building` |
| `"celebrating"` | `Celebrating` |
| `"sleeping"` | `Sleeping` |

**Response:** `200 OK` (empty body)

**Example:**
```bash
curl -X POST http://localhost:1420/api/state \
  -H "Content-Type: application/json" \
  -d '{"s": "thinking"}'
```

---

#### `GET /api/heartbeat`

Simple health check endpoint.

**Response:** `200 OK` (empty body)

**Example:**
```bash
curl http://localhost:1420/api/heartbeat
```

---

#### `GET /api/current`

Get the current pet state.

**Response:** `200 OK`

```json
{
  "animation": "running",
  "bubble": "正在写代码...",
  "core_signal": "running",
  "tool_label": "Edit",
  "overlay": null
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `animation` | `string` | Current animation name |
| `bubble` | `string` | Current speech bubble text |
| `core_signal` | `string` | Core signal: `"idle"`, `"waiting"`, `"running"`, `"ready"` |
| `tool_label` | `string` or `null` | Currently active tool name |
| `overlay` | `string` or `null` | Active overlay: `"permission"`, `"error"`, `"sleep"`, or `null` |

**Example:**
```bash
curl http://localhost:1420/api/current
```

---

#### `POST /api/hook/thinking`

Trigger the `Thinking` state (Claude Code is processing).

**Request Body:** none

**Response:** `200 OK`

---

#### `POST /api/hook/working`

Trigger a working state. The request body is parsed to extract the `tool_name` field.

**Request Body:**
```json
{
  "tool_name": "Edit"
}
```

**Tool → State Mapping:**

| Tool | PetState |
|------|----------|
| `"WebFetch"` | `Fetching` |
| `"WebSearch"` | `Searching` |
| `"Write"`, `"Edit"` | `Building` |
| `"Agent"`, `"TaskCreate"`, `"TaskUpdate"` | `Analyzing` |
| *(any other)* | `Running` |

**Response:** `200 OK`

---

#### `POST /api/hook/done`

Trigger the `Celebrating` state (task completed).

**Request Body:** none

**Response:** `200 OK`

---

#### `POST /api/hook/idle`

Trigger the `Idle` state (no active task). If the pet is currently `Sleeping`, the idle signal is ignored (does not wake the pet).

**Request Body:** none

**Response:** `200 OK`

---

#### `POST /api/hook/permission`

Trigger the `Permission` state (awaiting user decision).

**Request Body:** none

**Response:** `200 OK`

---

#### `POST /api/user/input`

Submit user input in response to a pending input request (from MCP `pet_ask` or `pet_get_user_input`).

**Request Body:**
```json
{
  "value": "user's response text",
  "type": "text"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | `string` | Yes | The user's input value |
| `type` | `string` | No | Input type hint (default: `"text"`) |

**Response:** `200 OK`

The submitted value is sent through the oneshot channel to the waiting MCP tool caller.

---

#### `GET /api/user/pending`

Check if there is a pending input request and get its type/options.

**Response:** `200 OK`

```json
{
  "waiting": true,
  "input_type": "select",
  "options": ["option1", "option2"]
}
```

If no input is pending:
```json
{
  "waiting": false
}
```

---

#### `POST /api/user/message`

Send a message to Claude Code through the pet UI. The message is:
1. Added to the pending messages queue in `StateManager`
2. Injected as keystrokes into the Claude Code terminal window via `SendInput` (Windows only)

**Request Body:**
```json
{
  "value": "Hello, Claude!"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | `string` | Yes | The message text to send |

**Response:** `200 OK`

---

#### `GET /api/user/message/pending`

Retrieve and clear pending user messages from the queue.

**Response:** `200 OK`

```json
{
  "messages": ["msg1", "msg2"],
  "count": 2
}
```

---

## MCP API

Defined in `src-tauri/src/mcp.rs`. Implements the [Model Context Protocol](https://modelcontextprotocol.io) over JSON-RPC 2.0.

**Endpoint**: `POST /mcp`  
**SSE Endpoint**: `GET /sse` (placeholder, returns `200 OK`)

### JSON-RPC Methods

#### `initialize`

MCP protocol handshake.

**Request:**
```json
{
  "id": 1,
  "method": "initialize"
}
```

**Response:**
```json
{
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "desktop-pet",
      "version": "0.1.0"
    },
    "capabilities": {
      "tools": {},
      "resources": {}
    }
  }
}
```

---

### Tools

#### `pet_show`

Display a custom bubble message on the desktop pet.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `msg` | `string` | Yes | The message text to display |

**Example:**
```json
{
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "pet_show",
    "arguments": {
      "msg": "Hello from Claude Code!"
    }
  }
}
```

**Response:**
```json
{
  "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "Message shown: Hello from Claude Code!" }]
  }
}
```

---

#### `pet_ask`

Ask the user a question through the pet UI. Blocks until the user responds.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | `string` | Yes | The question to display |
| `options` | `string[]` | No | Predefined options (switches input to "select" mode) |

**Example (freeform text):**
```json
{
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "pet_ask",
    "arguments": {
      "question": "What should I name this project?"
    }
  }
}
```

**Example (with options):**
```json
{
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "pet_ask",
    "arguments": {
      "question": "Which framework should I use?",
      "options": ["React", "Vue", "Svelte"]
    }
  }
}
```

**Response (user responded):**
```json
{
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "React" }]
  }
}
```

**Error Response (another input already pending):**
```json
{
  "id": 3,
  "error": {
    "code": -32603,
    "message": "Another input request is already pending"
  }
}
```

**Timeout:** 60 seconds (auto-cancels if the user does not respond).

---

#### `pet_play`

Force play a specific animation on the pet.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | `string` | Yes | One of: `"idle"`, `"thinking"`, `"running"`, `"review"`, `"failed"`, `"waving"`, `"jumping"` |
| `duration_ms` | `number` | No | Duration in milliseconds (not yet implemented) |

**Example:**
```json
{
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "pet_play",
    "arguments": {
      "state": "jumping"
    }
  }
}
```

**Response:**
```json
{
  "id": 4,
  "result": {
    "content": [{ "type": "text", "text": "Playing: jumping" }]
  }
}
```

---

#### `pet_get_user_input`

Block and wait for user input through the pet UI. Supports multiple input types.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | `string` | Yes | Question or prompt to show above the pet |
| `type` | `string` | No | Input type: `"text"` (default), `"confirm"`, or `"select"` |
| `options` | `string[]` | No | List of options for `"select"` type |
| `placeholder` | `string` | No | Placeholder text for the input field (`"text"` type only) |
| `timeout_secs` | `number` | No | Seconds to wait before auto-cancelling (default: `60`, max: `300`) |

**Supported Input Types:**

| Type | UI | Return Value |
|------|----|--------------|
| `"text"` | Freeform text input | The entered text |
| `"confirm"` | Yes/No buttons | `"yes"` or `"no"` |
| `"select"` | Pick from options | The selected option string |

**Example (confirm):**
```json
{
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "pet_get_user_input",
    "arguments": {
      "prompt": "Deploy to production?",
      "type": "confirm"
    }
  }
}
```

**Response (user confirms):**
```json
{
  "id": 5,
  "result": {
    "content": [{ "type": "text", "text": "yes" }]
  }
}
```

**Response (user did not respond):**
```json
{
  "id": 5,
  "result": {
    "content": [{ "type": "text", "text": "User did not respond (timeout)" }]
  }
}
```

**Error Response (invalid type):**
```json
{
  "code": -32602,
  "message": "Invalid type: must be text, confirm, or select"
}
```

---

### Resources

#### `pet://status`

Get the current pet state and animation info.

**Request:**
```json
{
  "id": 6,
  "method": "resources/read",
  "params": {
    "uri": "pet://status"
  }
}
```

**Response:**
```json
{
  "id": 6,
  "result": {
    "contents": [{
      "uri": "pet://status",
      "text": "State: Idle"
    }]
  }
}
```

---

#### `pet://history`

Get recent state change records.

**Request:**
```json
{
  "id": 7,
  "method": "resources/read",
  "params": {
    "uri": "pet://history"
  }
}
```

**Response:**
```json
{
  "id": 7,
  "result": {
    "contents": [{
      "uri": "pet://history",
      "text": "[{\"state\":\"Idle\",\"tool\":null,\"timestamp\":1718612345},...]"
    }]
  }
}
```

---

#### `pet://user-messages`

Retrieve and clear pending user messages sent from the pet UI.

**Request:**
```json
{
  "id": 8,
  "method": "resources/read",
  "params": {
    "uri": "pet://user-messages"
  }
}
```

**Response (with messages):**
```json
{
  "id": 8,
  "result": {
    "contents": [{
      "uri": "pet://user-messages",
      "text": "First message\n---\nSecond message"
    }]
  }
}
```

**Response (empty):**
```json
{
  "id": 8,
  "result": {
    "contents": [{
      "uri": "pet://user-messages",
      "text": "(no pending messages)"
    }]
  }
}
```

---

## Tauri IPC Commands

Defined in `src-tauri/src/main.rs`. Invoked from the frontend via `@tauri-apps/api` `invoke()`.

### Registration

```rust
.invoke_handler(tauri::generate_handler![
    start_drag,
    hide_window,
    exit_app,
    get_passthrough,
    set_passthrough,
])
```

### Commands

---

#### `start_drag`

Initiates window dragging. The frontend calls this on `mousedown` events to begin window movement.

**Parameters:** none

**Frontend Example (JavaScript):**
```javascript
import { invoke } from '@tauri-apps/api/core';
await invoke('start_drag');
```

---

#### `hide_window`

Hides the desktop pet window.

**Parameters:** none

**Frontend Example:**
```javascript
import { invoke } from '@tauri-apps/api/core';
await invoke('hide_window');
```

---

#### `exit_app`

Exits the entire application process.

**Parameters:** none

**Frontend Example:**
```javascript
import { invoke } from '@tauri-apps/api/core';
await invoke('exit_app');
```

---

#### `get_passthrough`

Returns whether click-through (mouse event passthrough) is currently enabled on the window.

**Parameters:** none

**Returns:** `Result<bool, String>`

| Return | Description |
|--------|-------------|
| `Ok(true)` | Click-through enabled — mouse events pass through the window |
| `Ok(false)` | Click-through disabled — window receives mouse events normally |
| `Err("HWND not available")` | Window handle not initialized yet |
| `Err("lock error: ...")` | Mutex lock failure |

**Frontend Example:**
```javascript
import { invoke } from '@tauri-apps/api/core';
const isPassthrough = await invoke('get_passthrough');
console.log(isPassthrough); // true or false
```

---

#### `set_passthrough`

Manually enables or disables click-through (mouse event passthrough). This overrides the auto-management until the next state change.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `enabled` | `bool` | `true` to enable click-through, `false` to disable |

**Returns:** `Result<(), String>`

**Frontend Example:**
```javascript
import { invoke } from '@tauri-apps/api/core';
await invoke('set_passthrough', { enabled: true });
```

### Auto-Management of Click-Through

The pet automatically manages click-through based on state:

| Pet State | Click-Through Behavior |
|-----------|----------------------|
| `Idle`, `Waving`, `Jumping` | Auto-enabled after 3-second debounce |
| `Sleeping` | Auto-enabled |
| `Thinking`, `Running`, `Chatting` | Disabled immediately |
| `Fetching`, `Searching`, `Analyzing`, `Building` | Disabled immediately |
| `Celebrating`, `Review` | Disabled immediately (brief display) |
| `Failed`, `Permission` | Disabled immediately (needs user interaction) |

Manual calls to `set_passthrough` override auto-management until the next state transition event.

---

## Window Management (Window Module)

Defined in `src-tauri/src/window.rs`.

The window module provides low-level Windows API wrappers for click-through control.

### Functions

| Function | Description |
|----------|-------------|
| `enable_click_through(hwnd)` | Adds `WS_EX_TRANSPARENT` — mouse events pass through |
| `disable_click_through(hwnd)` | Removes `WS_EX_TRANSPARENT` — window receives mouse events |
| `is_click_through_enabled(hwnd)` | Returns `true` if click-through is active |
| `get_ex_style(hwnd)` | Gets current extended window style flags |
| `set_ex_style(hwnd, style)` | Sets extended window style (preserves `WS_EX_LAYERED` and `WS_EX_TOOLWINDOW`) |

### Safety

All functions in this module are `unsafe` — they operate on raw window handles (`HWND`). The caller must ensure:

- `hwnd` is a valid top-level window handle
- `set_ex_style` always preserves `WS_EX_LAYERED` (transparent background) and `WS_EX_TOOLWINDOW` (hidden from taskbar)

---

## Type Index

| Type | File | Description |
|------|------|-------------|
| `PetState` | `state.rs` | Enum of 15 pet states |
| `StateManager` | `state.rs` | State machine with history |
| `StateRecord` | `state.rs` | Single state transition record |
| `StateChangeEvent` | `state.rs` | Event payload broadcast on state change |
| `PendingInput` | `state.rs` | Pending user input request (oneshot channel) |
| `SharedState` | `state.rs` | `Arc<Mutex<StateManager>>` |
| `PendingInputSlot` | `state.rs` | `Arc<Mutex<Option<PendingInput>>>` |
| `StateRequest` | `http.rs` | POST `/api/state` request body |
| `CurrentResponse` | `http.rs` | GET `/api/current` response body |
| `UserInputRequest` | `http.rs` | POST `/api/user/input` request body |
| `UserMessageRequest` | `http.rs` | POST `/api/user/message` request body |
| `JsonRpcRequest` | `mcp.rs` | MCP JSON-RPC request |
| `JsonRpcResponse` | `mcp.rs` | MCP JSON-RPC response |
| `McpState` | `mcp.rs` | `Arc<Mutex<StateManager>>` (MCP-specific alias) |
