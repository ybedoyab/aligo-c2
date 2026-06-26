# Node Registry

The **Node Registry** is the operator-facing inventory of lab nodes. A node appears when its process connects over WebSocket — you cannot fabricate live nodes from the UI.

## Registry fields

| Field | Description |
|-------|-------------|
| `id` | Stable identifier from the node process (e.g. `node-001`) |
| `alias` | Human-friendly display name |
| `tags` | Free-form labels for filtering (e.g. `lab`, `windows`) |
| `group` | Logical fleet grouping (e.g. `dmz`, `workstations`) |
| `description` | Operator notes |
| `enabled` | When `false`, tasks are rejected before dispatch |
| `trusted` | Registry trust flag for jury storytelling (not cryptographic) |
| `node_type` | `real`, `simulated`, or `ai_analyst` |
| `policy_id` | Execution policy assigned to this node |

## UI workflow

1. Open **Nodes** — cards and table show online/offline status, health, and registry badges.
2. Click a node (or **Nodes → detail page**) to open **Node Detail**.
3. Edit metadata and policy, then **Save**.
4. Use filters: status, OS, group, tag, minimum health.

## Delete rules

- **Offline nodes only** — the API returns `409` if you try to delete an online node.
- Deleting removes registry history for that node id; reconnecting re-registers it.

## Health score

The health score (0–100) is explainable in Node Detail:

- Heartbeat freshness
- Task success rate
- Average task latency
- Recent errors / timeouts

See the breakdown panel after opening a node.

## API

```
GET    /api/nodes?status=&os=&group=&tag=&min_health=
GET    /api/nodes/{id}
PATCH  /api/nodes/{id}
DELETE /api/nodes/{id}          # offline only
GET    /api/nodes/{id}/health   # score breakdown
```

## Demo talking points

> "Nodes are modular lab endpoints — not malware implants. They self-register when they connect. We track alias, group, trust, and policy per node, and we can disable a node without uninstalling anything."
