# Operator Console

The **Console** page (`/console`) is a safe, plugin-based operator interface. It is **not**
a remote shell and cannot execute arbitrary commands on nodes.

## What it is

A lab control panel that maps operator intent to **allowlisted plugins** only:

| Plugin | Purpose |
|--------|---------|
| `health_check` | Node uptime and liveness |
| `system_info` | OS, hostname, CPU, memory |
| `network_info` | Local interfaces (no scanning) |
| `list_lab_directory` | Sandbox directory listing |
| `echo` | Return supplied text |
| `allowed_command` | Fixed set: whoami, hostname, pwd, date |

## Form controls

1. **Target** — one node or all online nodes.
2. **Plugin** — pick from the allowlist.
3. **Arguments** — JSON textarea (validated server-side).
4. **Run** — creates a task per target via `POST /api/tasks` and dispatches over WebSocket.

## Terminal-style commands

The console accepts a restricted mini-language (parsed client-side, executed via safe APIs):

```text
run health_check on node-001
run system_info on all
verify task task-abc123
replay mission mission-lab-health-check
```

Unknown commands are rejected with a clear error. There is no `bash`, `powershell`, or free-form
shell passthrough.

## Command history

Each dispatch appears in the history table with timestamp, target, plugin, status, and a
**View evidence** button that opens the Task Execution Evidence modal.

## Security model

- Server validates plugins against `ALLOWED_PLUGINS` on every `POST /api/tasks`.
- Nodes only run registered plugin functions; no shell interpolation.
- See [security.md](security.md) for the full lab threat model.

## API backing

| Action | Endpoint |
|--------|----------|
| Run plugin | `POST /api/tasks` |
| Verify task | `GET /api/tasks/{id}/evidence` + `POST /api/ledger/events/{id}/verify` |
| Replay mission | Reads mission tasks from global state / timeline |

## Demo tip

For the jury: open **Console**, select **health_check**, target **all**, click **Run**, then
open evidence on a completed row to show plugin, args, stdout, and ledger hash.
