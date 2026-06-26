# Task Execution Evidence

Every task in Aligo Mission Ledger C2 can be inspected as verifiable **execution evidence**:
what plugin ran, with what arguments, on which node, and whether the result hash matches
the blockchain record.

## Opening evidence

| Location | How |
|----------|-----|
| **Nodes → detail** | Click node card → task history row |
| **Results console** | Click any result row |
| **Task activity** | Click any task row |
| **Console history** | **View evidence** button |
| **Demo page** | **Open latest task evidence** |
| **API** | `GET /api/tasks/{task_id}/evidence` |

## Modal fields

The **Task Execution Evidence** modal shows:

| Field | Source |
|-------|--------|
| `task_id`, `node_id`, `mission_id` | Task record |
| `plugin`, `args` | Task record |
| `status`, `stdout`, `stderr`, `exit_code`, `duration_ms` | Result record |
| `local_hash`, `previous_hash` | Ledger event (`TASK_RESULT` or `TASK_FAILED`) |
| `blockchain_tx_hash`, `on_chain_status` | Ledger event on-chain metadata |
| `integrity_status` | Computed: verified / pending_chain / tampered / local_only |

## Actions

- **Verify integrity** — calls `POST /api/ledger/events/{event_id}/verify`
- **Copy result JSON** — copies structured evidence to clipboard
- **Open ledger event** — navigates to Ledger page with event highlighted
- **Close**

## Node detail page

`GET /api/nodes/{node_id}/detail` returns:

- Node profile (hostname, OS, status, health, last heartbeat)
- Stats: total / successful / failed tasks
- Task history with plugin, args, duration, exit code, ledger event id, integrity status

## How integrity is determined

1. Find the primary ledger event for the task (`TASK_RESULT` > `TASK_FAILED` > `TASK_SENT`).
2. If ledger disabled → `local_only`.
3. If not anchored → `pending_chain` (local hash chain still valid).
4. If anchored → run verify: recompute canonical JSON hash, compare with on-chain
   `verifyEventHash`.

## Example workflow (jury)

1. Run *Lab Health Check* on three nodes.
2. Open evidence for one `health_check` task — show plugin name and JSON stdout.
3. Point at `local_hash` and **Verify** → `verified` when contract is configured.
4. Explain: changing the stored stdout would break the hash chain and show **tampered**.

## Related docs

- [blockchain-ledger.md](blockchain-ledger.md) — hash algorithm and on-chain storage
- [operator-console.md](operator-console.md) — dispatching tasks safely
