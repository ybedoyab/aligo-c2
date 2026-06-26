# Demo Script (5–7 minutes)

Have blockchain, server, frontend, and nodes ready. Open the **Demo** page for one-click
controls and the **Jury mode** checklist.

| Time | Segment | What to do | What to say |
|------|---------|------------|-------------|
| 0:00 | Intro | Dashboard title + sidebar chain status. | "Aligo Mission Ledger C2 — a lab C2 with verifiable execution evidence on a private blockchain. Safe plugins only; no real offensive tooling." |
| 0:30 | Architecture | Brief diagram or Console page. | "Operator UI, FastAPI server, modular nodes, and an ExecutionLedger contract. The Console maps commands to allowlisted plugins — not a remote shell." |
| 1:00 | Connect nodes | `python node.py --simulate-count 3` → **Nodes**. | "Three nodes online with live heartbeats. Click any card for full detail and per-node task history." |
| 1:30 | Run mission | **Demo → Start sample mission** (or Missions → Lab Health Check). | "A mission fans out health_check + system_info to every node. Task rows show the **plugin name**, not just an ID." |
| 2:30 | Evidence | Click a result → **Task Execution Evidence** modal. | "Here's exactly what ran: plugin, JSON args, stdout, duration, and the SHA-256 hash chained to previous events." |
| 3:30 | Console | **Console** → `run health_check on all`. | "The operator console only accepts safe plugin commands — try an unknown command and it rejects it." |
| 4:30 | Ledger | **Ledger** → **Anchor pending events** (if needed) → **Verify**. | "Events anchor on-chain. Verify compares local hash vs blockchain — **verified** means integrity holds." |
| 5:30 | Jury story | **Demo → Jury mode** checklist (all green). | "Five steps: nodes connected, mission run, tasks executed, results received, evidence on the ledger." |
| 6:30 | Close | **Show replay** + timeline with mission names and plugins. | "Full auditable chain from connect to verified evidence. Thank you." |

## 5-minute fast path

1. Connect nodes (terminal command on Demo page).
2. **Demo → Start sample mission**
3. **Demo → Open latest task evidence**
4. **Demo → Anchor pending ledger events**
5. **Demo → Verify latest ledger event**
6. **Demo → Show replay**

## Pre-flight checklist

- [ ] `npx hardhat node` running; `npx hardhat run scripts/deploy.ts --network localhost`
- [ ] `CONTRACT_ADDRESS` in `.env` **or** `deployment.json` at repo root
- [ ] Server restarted after setting contract (`/health` → `chain_status: connected`)
- [ ] Frontend sidebar shows **Live** and contract address snippet
- [ ] Nodes connected (`python node.py --simulate-count 3`)

## What to highlight for judges

- **Plugin visibility** — every row shows `health_check`, `system_info`, etc.
- **Evidence modal** — one-click proof of what executed
- **Anchor + Verify** — blockchain is not decorative; it's checked live
- **Safety** — Console rejects arbitrary shell; see [operator-console.md](operator-console.md)
