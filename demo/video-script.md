# Video Script (ready to record)

Target length: ~5 minutes. Record at 1080p+. Have the stack running and the **Demo** page
open before you hit record. Keep one terminal visible for launching agents.

---

## Scene 1 — Hook (0:00–0:20)

**Show:** Dashboard with the title and the live indicator.

**Say:**
> "What if a Command-and-Control couldn't lie to you about what it did? This is **Aligo
> Mission Ledger C2** — a lab C2 where every action is cryptographically anchored on a
> blockchain, so results can be proven untampered. And it's safe by design: no real attacks,
> just a controlled lab."

---

## Scene 2 — Architecture (0:20–0:50)

**Show:** The architecture diagram (README or `docs/architecture.md`).

**Say:**
> "Four pieces: a React operator dashboard, a FastAPI server, modular Python agents over
> WebSockets, and a private blockchain anchoring a Proof-of-Execution Ledger. Agents only
> run a safe allowlist of plugins — there's no arbitrary shell."

---

## Scene 3 — Connect agents (0:50–1:30)

**Clicks/typing:**
1. In the terminal: `python agent.py --simulate-count 3`
2. Switch to the **Agents** page.

**Say:**
> "I'll connect three agents. They register, start heartbeating, and show up as online with
> health scores — all live, no page refresh. If one drops, it degrades to warning, then
> offline, and reconnects automatically with backoff."

---

## Scene 4 — Build & run a mission (1:30–2:40)

**Clicks:**
1. Go to **Missions**.
2. Point at the preset library (*Lab Health Check*, *Basic Recon*, *Directory Audit*,
   *Multi-Agent Status*).
3. In the builder: name it, keep steps `health_check` → `system_info`, select all 3 agents.
4. Click **Create & run**.

**Say:**
> "Missions are reusable templates of safe plugins. I'll target all three agents and run.
> The server fans out one task per agent per step. Watch the Task activity panel: pending →
> sent → success."

---

## Scene 5 — Results (2:40–3:20)

**Clicks:** Expand a result in the Results console.

**Say:**
> "Each agent returned structured output — OS, hostname, uptime, exit code, duration in
> milliseconds — persisted on the server. This is normal C2 functionality. Now the
> interesting part."

---

## Scene 6 — The Ledger (3:20–4:20)

**Clicks:** Go to **Ledger**; scroll the chained events; point at block numbers.

**Say:**
> "Every step emitted an event: agent registered, mission started, task sent, result
> received. Each one is SHA-256 hashed over a canonical JSON form, chained with the previous
> hash, and anchored on-chain — here are the transaction block numbers."

---

## Scene 7 — Verify (the money shot) (4:20–4:50)

**Clicks:** Click **Verify** on a `TASK_RESULT` event → shows **verified**.

**Say:**
> "Verify recomputes the local hash and compares it with the on-chain value — **verified**.
> If anyone edited a stored result in the database, the recomputed hash wouldn't match and
> it would show **tampered**. That's verifiable, auditable execution."

---

## Scene 8 — Replay & close (4:50–5:10)

**Clicks:** Go to **Demo** → **Show replay**.

**Say:**
> "Here's the whole operation replayed: connect, mission, task, result, ledger, verified.
> Aligo Mission Ledger C2 — mission-based, multi-agent, and provably honest. Thanks for
> watching."

---

## B-roll / cutaways (optional)

- `docs/security.md` allowlist section while mentioning safety.
- A quick `python -m pytest -q` showing tests pass.
- The Swagger UI at `http://localhost:8000/docs`.

## Recording checklist

- [ ] Contract deployed; `/health` shows `ledger_available: true`.
- [ ] Ledger has at least a couple of events before recording (do one warm-up run).
- [ ] Font size bumped in terminal/editor for readability.
- [ ] Close noisy notifications.
