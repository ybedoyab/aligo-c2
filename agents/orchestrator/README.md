# Aligo Agent — AI Orchestration Layer

A Claude-based AI orchestrator that sits **on top of** the existing Aligo C2 MVP as a
**separate process and a pure client of the C2 server**. It plans and drives
recon / enumeration / health-check missions in natural language, while **execution always
requires explicit human approval**.

> Built per [`../../agent-plan.md`](../../agent-plan.md). It changes **no** existing code in
> `server/`, `node/`, `blockchain/`, or `frontend/`. It talks only over the C2's public
> REST API and the read-only `/ws/operator` WebSocket — never to nodes, the DB, or server
> internals. So every action it drives is dispatched, hashed, and anchored in the ledger
> identically to a manual one, and it has **no capability the manual operator lacks**.

## Why this is safe

- **Bounded action space.** The agent may only propose the C2 plugin allowlist
  (`system_info`, `health_check`, `echo`, `network_info`, `list_lab_directory`,
  `allowed_command`) with their exact args. The server's Pydantic validator rejects
  anything else with a 422 — the hard backstop — but the agent is also told never to
  invent a plugin or argument.
- **Human-in-the-loop gate.** Defining a mission and executing it are separate steps.
  The agent may freely call read tools and `create_mission_draft` (which does **not**
  run anything). The gated tools — `start_mission`, `create_adhoc_task`,
  `start_sample_mission` — only run after the operator explicitly approves the specific
  action via a LangGraph `interrupt()`.
- **One auditable I/O surface.** All C2 calls go through `app/c2_client.py`. Nothing else
  in the agent does network I/O to the C2.

## Layout

Each agent lives in its own self-contained folder under `agents/`; this one is
`agents/orchestrator/`.

```
agents/orchestrator/
├── app/
│   ├── main.py         # FastAPI: POST /chat (SSE stream), GET /health
│   ├── config.py       # pydantic-settings (ANTHROPIC_API_KEY, C2_BASE_URL, ...)
│   ├── c2_client.py    # async httpx client — the ONLY I/O to the C2
│   ├── ws_listener.py  # background /ws/operator subscriber -> live state
│   ├── tools.py        # LangChain tools (read + draft + gated writes) + plugin catalog
│   ├── graph.py        # LangGraph: agent -> (interrupt: approve?) -> tools -> observe
│   └── prompts.py      # system prompt: role, scope, allowlist, draft-then-approve
├── requirements.txt
├── .env.example
└── smoke_test.py       # Phase 0: exercise c2_client against a running server
```

## Run (recommended — via `dev.py`)

The whole stack, including this agent, starts with one command from the repo root:

```bash
# put ANTHROPIC_API_KEY in the repo-root .env first (optional but needed for chat)
python dev.py
```

`dev.py` installs this agent's deps into the shared venv, launches the backend on
**:8100**, and points it at the C2 over TLS (`C2_BASE_URL=https://127.0.0.1:8000`,
`C2_VERIFY_TLS=false` for the self-signed lab cert). The dashboard reaches it through the
Vite proxy at `/agent`, so the **Console → Ask AI** panel works with no extra setup. If the
key is missing the stack still runs; only the chat path is disabled.

## Run (standalone)

```bash
cd agents/orchestrator
python -m venv .venv && . .venv/Scripts/activate   # Windows; use .venv/bin/activate on POSIX
pip install -r requirements.txt
cp .env.example .env        # then set ANTHROPIC_API_KEY
```

Then, with the C2 stack and a few simulated nodes already running
(`python node.py --simulate-count 3`):

1. **Phase 0 — verify the contract wiring** (no key needed):
   ```bash
   python smoke_test.py
   ```
   Lists nodes / missions / ledger events from the live C2.
2. **Run the agent backend:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8100
   ```
   `GET http://localhost:8100/health` reports model, key-configured, and C2 reachability.
   When talking to a TLS C2, set `C2_BASE_URL`/`C2_WS_URL` to `https`/`wss` and
   `C2_VERIFY_TLS=false` in `.env`.

## The `/chat` SSE protocol

`POST /chat` is turn-based over a session keyed by `session_id`.

- **Start / continue a turn:**
  ```json
  { "session_id": "demo-1", "message": "Check the health of every online node." }
  ```
- The response is an SSE stream of events:
  `token` (assistant text), `tool_call`, `tool_result`, `approval_request`, `error`, `done`.
- When the agent proposes a gated action, the stream emits **`approval_request`** with the
  exact tool + args and then a `done` with `"awaiting_approval": true`. The run is paused
  on a LangGraph `interrupt()`.
- **Approve or reject** by POSTing to the same session:
  ```json
  { "session_id": "demo-1", "approval": { "approved": true } }
  ```
  ```json
  { "session_id": "demo-1", "approval": { "approved": false, "feedback": "only node-001" } }
  ```
  On approve, the agent executes and then summarizes; on reject, it leaves the draft alone
  and revises.

Quick manual test (with the backend running and a key set):

```bash
curl -N http://localhost:8100/chat \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"demo-1","message":"Which nodes are online?"}'
```

## Demo flow (end to end)

1. Operator → Agent: *"Check the health of every online node."*
2. Agent gathers nodes (read tools), **proposes** a Lab-Health-style mission, creates it as
   a **draft**, and asks for approval.
3. Operator approves → Agent calls `/start` → tasks run → Agent summarizes streamed results
   and points to the ledger.
4. Verify a ledger event (`verified`) to show the Agent-driven run is tamper-evident —
   identical guarantees as a manual run.

## Scope (v1)

Mission-planner over the safe allowlist only: no arbitrary shell, no new plugins, no
capability the manual operator lacks. Expanding the action space is a separate
scope/ethics decision (see `agent-plan.md` §7).

## Operator surface (Phase 5 — done)

The agent chat lives in the existing **Console** tab as an **Ask AI** panel beside the
manual plugin console (CloudWatch-style: type a command, or ask the agent). The browser
talks to this agent backend (via the Vite `/agent` proxy under TLS, or `VITE_AGENT_URL`
without TLS), never to the C2 directly — so the server's CORS needs no change. Frontend
pieces: `frontend/src/api/agentClient.ts` (SSE client) and
`frontend/src/components/AgentChat.tsx` (chat + inline approval UI).
