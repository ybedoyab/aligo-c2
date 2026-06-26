# Demo Script (5–7 minutes)

Have blockchain, server, frontend, and nodes ready. Open the **Demo** page for one-click
controls and the **Jury mode** checklist.

| Time | Segment | What to do | What to say |
|------|---------|------------|-------------|
| 0:00 | Intro | Dashboard title + sidebar chain status. | "Aligo Mission Ledger C2 — a lab C2 with verifiable execution evidence on a private blockchain. Safe plugins only; no real offensive tooling." |
| 0:30 | Topology | **Topology** page or Dashboard fleet strip. | "Operator UI, FastAPI server, modular nodes, and an ExecutionLedger contract — one map of the lab." |
| 1:00 | Connect nodes | `python node.py --simulate-count 3` → **Nodes**. | "Three nodes online with live heartbeats. Click any row for registry metadata, policy, and explainable health score." |
| 1:30 | Run mission | **Demo → Start sample mission** (or Missions → Lab Health Check). | "A mission fans out health_check + system_info to every node. Every row shows plugin, node, and mission." |
| 2:30 | Evidence | Click a result → **Task Execution Evidence** modal. | "Full audit packet: plugin, JSON args, stdout, duration, local hash, on-chain status — Verify integrity in one click." |
| 3:00 | Policy | Node Detail → `basic_safe` → Console: `run network_info on node-001`. | "Policies gate plugins before dispatch — blocked tasks show **blocked_by_policy** and a **PLUGIN_BLOCKED** ledger event." |
| 3:30 | Console | **Console** → `run health_check on all`. | "The operator console only accepts safe plugin commands — not a remote shell." |
| 4:30 | Ledger | **Demo → Anchor pending** → **Verify latest**. | "Events anchor on-chain. Verify compares local hash vs blockchain — **verified** means integrity holds." |
| 5:00 | Tamper | **Demo → Simulate tamper** → Evidence → Verify. | "Controlled lab demo: we tamper a local copy only — Verify flags **tampered** because the chain record is immutable." |
| 5:30 | Export | **Demo → Export mission report (MD)**. | "Mission dossier for the jury: tasks, results, ledger hashes, timeline, and summary." |
| 6:30 | Close | **Show replay** + timeline with mission names, plugins, ledger badges. | "Full auditable chain from connect to verified evidence. Thank you." |

## 5-minute fast path

1. Connect nodes (terminal command on Demo page).
2. **Demo → Start sample mission**
3. **Demo → Open latest task evidence**
4. **Demo → Anchor pending ledger events**
5. **Demo → Verify latest ledger event**
6. **Demo → Simulate tamper** → Verify again → **tampered**
7. **Demo → Export mission report (Markdown)**
8. **Demo → Show replay**

## Pre-flight checklist

- [ ] `npx hardhat node` running; `npx hardhat run scripts/deploy.ts --network localhost`
- [ ] `CONTRACT_ADDRESS` in `.env` **or** `deployment.json` at repo root
- [ ] Server restarted after setting contract (`/health` → `chain_status: connected`)
- [ ] Frontend sidebar shows **Live** and contract address snippet
- [ ] Nodes connected (`python node.py --simulate-count 3`)

## What to highlight for judges

- **Node registry** — alias, group, policy, trusted/disabled badges ([node-registry.md](node-registry.md))
- **Policy enforcement** — PLUGIN_BLOCKED audit trail ([node-policies.md](node-policies.md))
- **Plugin visibility** — every row shows `health_check`, `system_info`, etc.
- **Evidence modal** — one-click proof of what executed ([task-evidence.md](task-evidence.md))
- **Mission report export** — JSON + Markdown dossier ([mission-report.md](mission-report.md))
- **Anchor + Verify** — blockchain is not decorative; it's checked live
- **Tamper demo** — integrity detection in a controlled lab ([tamper-demo.md](tamper-demo.md))
- **Safety** — Console rejects arbitrary shell; see [operator-console.md](operator-console.md)

## Optional: AI analyst placeholder

In Node Detail, set **node type** to `ai_analyst` and explain future summarization — no external AI in this build ([ai-analyst-node.md](ai-analyst-node.md)).
