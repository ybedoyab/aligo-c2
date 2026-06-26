# Aligo Mission Ledger C2

> A lab-only, authorized Command & Control (C2) platform with a blockchain-backed
> **Proof-of-Execution Ledger**. Built for the Aligo Defensores Informáticos hackathon.

## Pitch

> A mission-based laboratory C2 with modular agents and verifiable, blockchain-anchored
> auditing. Instead of being a plain remote console, it lets you create reusable missions,
> run them across multiple agents, monitor results in real time, and register evidence
> hashes on a private blockchain to prove the operation was not tampered with.

## Ethical notice (read first)

This project is intended **exclusively** for closed, controlled, and **authorized**
laboratory environments. It deliberately **does not** implement real malware, evasion,
stealth, aggressive persistence, antivirus bypass, real lateral movement, exfiltration,
credential theft, or offensive execution against third parties. Agents only run a small
**allowlist of safe plugins** and never expose an arbitrary shell. See
[`docs/security.md`](docs/security.md) and [`docs/limitations.md`](docs/limitations.md).

## Architecture

```mermaid
flowchart LR
  Operator["React Dashboard<br/>(Vite + TS + Tailwind)"] -->|"REST + /ws/operator"| Server
  Server["FastAPI C2 Server<br/>(REST + WebSockets)"] -->|"/ws/agent"| Agent["Python Agent<br/>(asyncio + safe plugins)"]
  Server -->|SQLModel| DB[("SQLite / PostgreSQL")]
  Server -->|web3.py| Chain["Hardhat node<br/>ExecutionLedger.sol"]
```

| Component | Stack | Responsibility |
|-----------|-------|----------------|
| Server | Python 3.12, FastAPI, WebSockets, SQLModel | Coordinates agents, missions, tasks, ledger |
| Agent | Python 3.12, asyncio, websockets | Connects, heartbeats, runs safe plugins |
| Frontend | React, Vite, TypeScript, Tailwind | Operator dashboard + jury demo |
| Blockchain | Hardhat, Solidity | On-chain proof-of-execution ledger |
| Bridge | web3.py | Server ↔ contract integration |

Full details in [`docs/architecture.md`](docs/architecture.md).

## Requirements

- Python 3.12+
- Node.js 20+ and npm
- (Optional) Docker + Docker Compose

## Quick start with Docker Compose

```bash
cp .env.example .env
docker compose up --build
# Then deploy the contract once the blockchain container is healthy:
docker compose exec blockchain npx hardhat run scripts/deploy.ts --network localhost
# Copy the printed address into .env (CONTRACT_ADDRESS=...) and restart the server:
docker compose up -d --no-deps server
```

- Dashboard: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs
- Hardhat RPC: http://localhost:8545

## Local install (without Docker)

```bash
cp .env.example .env
```

### 1. Blockchain (terminal 1)

```bash
cd blockchain
npm install
npx hardhat node            # starts a local chain on :8545
```

### 2. Deploy the contract (terminal 2)

```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network localhost
# prints CONTRACT_ADDRESS -> paste it into .env
```

### 3. Server (terminal 3)

```bash
cd server
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

> On Windows PowerShell, set `DATABASE_URL` via `.env`; the Makefile targets assume a
> Unix-like shell, so run the commands above directly if `make` is unavailable.

### 4. Frontend (terminal 4)

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### 5. Agents (terminal 5)

```bash
cd agent
python -m pip install -r requirements.txt
python agent.py --agent-id agent-001
# or launch a simulated fleet:
python agent.py --simulate-count 3
```

## Running a mission

1. Open the dashboard and confirm agents show **online** under **Agents**.
2. Go to **Missions**, pick a predefined mission (e.g. *Lab Health Check*) or build one.
3. Select target agents and start the mission.
4. Watch tasks move `pending → sent → running → success` and results stream in.
5. Open **Ledger** to see the chained events; click **Verify** on any event.

The **Demo** page provides large jury-friendly buttons for the whole flow.

## Verifying the ledger

Each important event is serialized to canonical JSON, hashed with SHA-256, chained with
`previous_hash`, stored in the DB, and anchored on-chain. Verification recomputes the local
hash and compares it with the value returned by the contract's `verifyEventHash`, showing
**verified** or **tampered**. See [`docs/blockchain-ledger.md`](docs/blockchain-ledger.md).

## Demo

A 5–7 minute script is in [`docs/demo-script.md`](docs/demo-script.md) and a recording
script in [`demo/video-script.md`](demo/video-script.md). Sample data lives in
[`demo/sample-missions.json`](demo/sample-missions.json).

Expected demo flow: start blockchain → deploy contract → start server → start frontend →
connect 2–3 agents → see them online → create *Lab Health Check* → run across agents →
watch live results → inspect ledger events → verify integrity → show the timeline replay.

## Documentation

- [Architecture](docs/architecture.md)
- [Protocol](docs/protocol.md)
- [Security](docs/security.md)
- [Blockchain Ledger](docs/blockchain-ledger.md)
- [Deployment](docs/deployment.md)
- [Demo Script](docs/demo-script.md)
- [Scoring Strategy](docs/scoring-strategy.md)
- [Limitations](docs/limitations.md)

## Known limitations

Not for production. Local blockchain is for demonstration only. The shared token is not a
substitute for real PKI. SQLite is the default store. Plugins are intentionally limited for
safety. See [`docs/limitations.md`](docs/limitations.md).

## License / use

Authorized laboratory use only. Do not deploy against systems you do not own or are not
explicitly authorized to test.
