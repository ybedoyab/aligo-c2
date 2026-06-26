# Deployment

Two supported paths: local processes (best for development/demo) and Docker Compose.

## Ports

| Service | Port | Notes |
|---------|------|-------|
| C2 server (FastAPI) | 8000 | REST + WebSockets, Swagger at `/docs` |
| Frontend (Vite dev) | 5173 | Dev server |
| Frontend (Docker/nginx) | 5173 → 80 | Static build served by nginx |
| Hardhat node | 8545 | JSON-RPC |

## Environment variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `SERVER_HOST` / `SERVER_PORT` | `0.0.0.0` / `8000` | Server bind address |
| `DATABASE_URL` | `sqlite:///./c2.db` | DB DSN (swap for PostgreSQL) |
| `AGENT_SHARED_TOKEN` | `change-me-lab-token` | Token agents present on register |
| `LEDGER_ENABLED` | `true` | Toggle on-chain anchoring |
| `BLOCKCHAIN_RPC_URL` | `http://blockchain:8545` | Hardhat JSON-RPC endpoint |
| `CONTRACT_ADDRESS` | _(empty)_ | Filled after deploy |
| `BLOCKCHAIN_PRIVATE_KEY` | Hardhat acct #0 | Signing key (lab only) |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |

> The server also accepts agent-side env (`C2_WS_URL`, `AGENT_ID`, `AGENT_HEARTBEAT_INTERVAL`,
> `AGENT_TASK_TIMEOUT`, `AGENT_RECONNECT_*`). See [`agent/config.py`](../agent/config.py).

## Local (without Docker)

Prerequisites: Python 3.12+, Node 20+.

```bash
cp .env.example .env

# 1) Blockchain
cd blockchain && npm install && npx hardhat node     # terminal 1

# 2) Deploy contract (terminal 2) -> copy address into .env CONTRACT_ADDRESS
cd blockchain && npx hardhat run scripts/deploy.ts --network localhost

# 3) Server (terminal 3)
cd server && python -m pip install -r requirements.txt
#   set BLOCKCHAIN_RPC_URL=http://localhost:8545 in .env for local runs
uvicorn app.main:app --reload --port 8000

# 4) Frontend (terminal 4)
cd frontend && npm install && npm run dev

# 5) Agents (terminal 5)
cd agent && python -m pip install -r requirements.txt
python agent.py --simulate-count 3
```

> For local (non-Docker) runs, set `BLOCKCHAIN_RPC_URL=http://localhost:8545` in `.env`
> (the `blockchain` hostname only resolves inside Docker).

### Windows PowerShell notes

`make` may be unavailable; run the underlying commands directly. The agent connects to
`C2_WS_URL` (default `ws://localhost:8000/ws/agent`); override per shell if needed:

```powershell
$env:C2_WS_URL = "ws://localhost:8000/ws/agent"
python agent.py --agent-id agent-001
```

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
# Deploy the contract into the running node:
docker compose exec blockchain npx hardhat run scripts/deploy.ts --network localhost
# Put the printed address in .env (CONTRACT_ADDRESS=...) then restart the server:
docker compose up -d --no-deps server
```

Compose brings up `blockchain`, `server`, `frontend`, and two agents (`agent-1`,
`agent-2`). The server waits for the blockchain healthcheck before starting.

## Make targets

`make dev | server | frontend | blockchain | deploy-contract | agent | demo | test | clean`
(see [`Makefile`](../Makefile)). On Windows, use the explicit commands above.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Dashboard shows "local only" for ledger | `CONTRACT_ADDRESS` empty, chain down, or `LEDGER_ENABLED=false`. Deploy the contract and set the address; restart the server. |
| `HH501: Couldn't download compiler` | Hardhat needs internet on first compile to fetch `solc`. Run `npx hardhat compile` once with network access. |
| Agents never go online | Wrong `C2_WS_URL` or bad `AGENT_SHARED_TOKEN`. Check both match the server's `.env`. |
| Tasks immediately `failed` ("agent not connected") | Target agent isn't connected; start the agent or select online agents. |
| CORS errors in browser | `FRONTEND_URL` doesn't match the dashboard origin. |
| `No module named pip` | Bootstrap with `python -m ensurepip --upgrade`. |
| Verify shows `pending_chain` | Event stored locally but not anchored (chain disabled/unreachable). Still locally consistent. |
| Reset everything | `make clean` (or delete `server/c2.db`, `blockchain/artifacts`, `blockchain/cache`, `deployment.json`). |
