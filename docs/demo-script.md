# Demo Script (5–7 minutes)

A timed walkthrough for the jury. Have everything running beforehand (blockchain + contract
deployed, server, frontend, and the **Demo** page open). Keep a terminal visible for agents.

| Time | Segment | What to do | What to say |
|------|---------|------------|-------------|
| 0:00 | Intro | Show the dashboard title. | "This is **Aligo Mission Ledger C2** — a lab C2 with a blockchain-backed Proof-of-Execution Ledger. Everything here is built for an authorized lab; there's no real offensive capability." |
| 0:30 | Architecture | Open `docs/architecture.md` diagram or the slide. | "Four parts: a React operator dashboard, a FastAPI server, modular Python agents over WebSockets, and a private blockchain that anchors a tamper-evident ledger." |
| 1:00 | Dashboard | Point at the metric cards and live indicator (sidebar "Live"). | "The dashboard updates in real time over a WebSocket — no refreshing. Right now zero agents." |
| 1:30 | Connect agents | In the terminal run `python agent.py --simulate-count 3`. Switch to **Agents**. | "I'll connect three agents. Watch them appear as **online** with health scores and live heartbeats." |
| 2:00 | Create a mission | Go to **Missions**. Show the preset library; open the builder. | "Missions are reusable templates of safe plugins. I can pick a preset like *Lab Health Check*, or build one: health_check then system_info, targeting all three agents." |
| 3:00 | Run tasks | Click **Run** on *Lab Health Check* (or **Create & run**). | "Starting the mission fans out one task per agent per step. Watch tasks move pending → sent → success in the Task activity panel." |
| 4:00 | See results | Expand a result in the Results console. | "Each agent returned structured output — OS, hostname, uptime, exit code, duration. All persisted server-side." |
| 5:00 | Show ledger | Go to **Ledger**. Scroll the chained events. | "Every step generated an event: agent registered, mission started, task sent, result received. Each is SHA-256 hashed over canonical JSON, chained by previous_hash, and anchored on-chain — see the block numbers." |
| 6:00 | Verify integrity | Click **Verify** on a TASK_RESULT event → **verified**. (Optional) describe tampering. | "Verify recomputes the local hash and compares it with the on-chain value: **verified**. If anyone edited a stored result, the hashes diverge and it shows **tampered** — that's the whole point: trustworthy, auditable execution." |
| 6:30 | Close | Go to **Demo** → click **Show replay**. | "Here's the full timeline replayed: connect → mission → task → result → ledger → verified. Thanks — Aligo Mission Ledger C2: missions, modular agents, and verifiable proof of execution." |

## Backup one-click path (if time is short)

Open **Demo** and use the big buttons in order: **Start sample mission → Run health check
→ Verify ledger → Show replay**. Connect agents first via the terminal command shown on the
page.

## Pre-flight checklist

- [ ] `npx hardhat node` running; contract deployed; `CONTRACT_ADDRESS` set in `.env`.
- [ ] Server running (`/health` shows `ledger_available: true`).
- [ ] Frontend open; sidebar shows **Live**.
- [ ] Terminal ready with the agent command.
- [ ] One previous run done so the ledger isn't empty (optional, for safety).
