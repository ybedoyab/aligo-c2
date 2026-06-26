# Task Execution Evidence

Every task and result row opens the **Task Execution Evidence** modal — a single pane for operators and jurors to inspect what ran and how it was recorded.

## Fields shown

| Section | Fields |
|---------|--------|
| Mission | `mission_name`, `mission_id` |
| Execution | `node_id`, `plugin`, `args` (JSON), `status` |
| Output | `stdout`, `stderr`, `exit_code`, `duration_ms` |
| Timestamps | `created_at`, `sent_at`, `completed_at` |
| Integrity | `local_hash`, `previous_hash`, `integrity_status` |
| On-chain | `on_chain_status`, `block_number`, `tx_hash`, `ledger_event_id` |

## Actions

| Button | Behavior |
|--------|----------|
| **Verify integrity** | Recomputes local hash and compares with on-chain record |
| **Copy evidence JSON** | Full evidence payload to clipboard |
| **Export evidence JSON** | Download `.json` file |
| **Open ledger event** | Navigate to Ledger page filtered to the event |

## Where to open evidence

- **Missions** — task activity + results console
- **Console** — command history → View evidence
- **Demo** — Open latest task evidence
- **Ledger** — linked from evidence modal

## Integrity statuses

| Badge | Meaning |
|-------|---------|
| `verified` | Local hash matches on-chain |
| `pending_chain` | Anchored locally, not yet confirmed on-chain |
| `tampered` | Local record no longer matches chain (see tamper demo) |
| `local_only` | Chain disabled or event not anchored |

## API

```
GET /api/tasks/{task_id}/evidence
POST /api/ledger/{event_id}/verify
```

## Demo script line

> "This modal is our proof-of-execution packet: exactly which plugin ran, with what arguments, what it returned, and the SHA-256 hash chained to prior events and anchored on our private ledger."
