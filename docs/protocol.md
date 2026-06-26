# Node ↔ Server Protocol

Transport: WebSocket (`/ws/node`), JSON text frames, UTF-8. Protocol version `1.0`.
All messages are objects with a `type` field. Inbound frames are size-capped
(`MAX_WS_MESSAGE_BYTES`, default 256 KiB).

## Message types

| Type | Direction | Purpose |
|------|-----------|---------|
| `register` | node → server | First message; authenticate and identify. |
| `register_ack` | server → node | Registration accepted. |
| `heartbeat` | node → server | Liveness ping (every ~5s). |
| `task` | server → node | Execute a plugin with args. |
| `task_ack` | node → server | Optional acknowledgement of a task. |
| `result` | node → server | Structured execution result. |
| `error` | both | Error notification (non-fatal). |
| `mission_start` | server → operator* | Mission run started (broadcast). |
| `mission_complete` | server → operator* | Mission finished (broadcast). |

\* `mission_start` / `mission_complete` are represented on the operator channel as
`mission_update` messages plus `MISSION_STARTED` / `MISSION_COMPLETED` ledger events.

## Handshake

1. Node connects and immediately sends `register` (including the shared `token`).
2. Server validates the token (constant-time compare). On failure it sends `error` and
   closes with code `1008`.
3. On success the server persists the node, replies `register_ack`, anchors
   `NODE_REGISTERED` (or `NODE_RECONNECTED`), and starts streaming tasks.

## Schemas & examples

### register (node → server)

```json
{
  "type": "register",
  "protocol": "1.0",
  "node_id": "node-001",
  "hostname": "lab-node-001",
  "os": "Linux",
  "username": "lab-user",
  "token": "change-me-lab-token",
  "timestamp": "2026-06-26T10:00:00Z"
}
```

Validated by `NodeRegister` ([`schemas/node.py`](../server/app/schemas/node.py)).

### register_ack (server → node)

```json
{ "type": "register_ack", "node_id": "node-001", "server_time": "2026-06-26T10:00:00.123Z" }
```

### heartbeat (node → server)

```json
{ "type": "heartbeat", "node_id": "node-001", "timestamp": "2026-06-26T10:00:05Z" }
```

### task (server → node)

```json
{
  "type": "task",
  "task_id": "task-123",
  "mission_id": "mission-001",
  "plugin": "system_info",
  "args": {},
  "timestamp": "2026-06-26T10:01:00Z"
}
```

`plugin` must be in the allowlist; unknown plugins yield a `failed` result.

### task_ack (node → server)

```json
{ "type": "task_ack", "task_id": "task-123", "node_id": "node-001", "timestamp": "2026-06-26T10:01:00Z" }
```

### result (node → server)

```json
{
  "type": "result",
  "task_id": "task-123",
  "mission_id": "mission-001",
  "node_id": "node-001",
  "status": "success",
  "stdout": "{\"os\":\"Linux\",\"hostname\":\"lab-node-001\"}",
  "stderr": "",
  "exit_code": 0,
  "duration_ms": 42,
  "metadata": { "plugin": "system_info" },
  "timestamp": "2026-06-26T10:01:01Z"
}
```

Validated by `ResultIn` ([`schemas/result.py`](../server/app/schemas/result.py)). `stdout`
is the plugin's JSON-encoded return value.

### error (either direction)

```json
{ "type": "error", "node_id": "node-001", "error": "invalid node token", "timestamp": "..." }
```

## States

- **Node status**: `online`, `warning`, `offline`, `error`.
- **Mission status**: `draft`, `running`, `completed`, `failed`, `partially_failed`.
- **Task status**: `pending`, `sent`, `running`, `success`, `failed`, `timeout`.

## Errors

| Condition | Server behavior |
|-----------|-----------------|
| First message is not `register` | `error` + close `1008`. |
| Invalid JSON | `error` (handshake: close; loop: continue). |
| Bad/missing token | `error` + close `1008`. |
| Message exceeds size cap | `error`, message ignored. |
| Unknown message type | `error`, connection kept open. |
| Unknown plugin | Node returns `result` with `status=failed`. |
| Plugin timeout | Node returns `result` with `status=timeout`, `exit_code=124`. |

## Operator channel (`/ws/operator`)

Server → operator broadcast messages: `connected`, `node_update`, `task_update`,
`result`, `mission_update`, `ledger_event`. Operators may send `{"type":"ping"}` and
receive `{"type":"pong"}`.

## Versioning

The `protocol` field carries the semantic version (`MAJOR.MINOR`). Backward-compatible
additions (new optional fields, new message types) bump MINOR. Breaking changes bump MAJOR;
the server may then reject mismatched majors during `register`. Current version: **1.0**.
