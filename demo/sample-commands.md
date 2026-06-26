# Sample Commands

Copy-paste commands for running and exercising the demo. Assumes `.env` exists
(`cp .env.example .env`) and, for local runs, `BLOCKCHAIN_RPC_URL=http://localhost:8545`.

## Bring up the stack (local)

```bash
# Terminal 1 - blockchain
cd blockchain && npm install && npx hardhat node

# Terminal 2 - deploy contract (copy address into .env CONTRACT_ADDRESS)
cd blockchain && npx hardhat run scripts/deploy.ts --network localhost

# Terminal 3 - server
cd server && python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 4 - frontend
cd frontend && npm install && npm run dev

# Terminal 5 - nodes
cd node && python -m pip install -r requirements.txt
python node.py --simulate-count 3
```

## Nodes

```bash
# Single named node
python node.py --node-id node-001

# Several individual nodes (separate shells)
python node.py --node-id node-001
python node.py --node-id node-002
python node.py --node-id node-003

# A simulated fleet in one process
python node.py --simulate-count 10

# Override server URL / token
python node.py --node-id node-007 --ws-url ws://localhost:8000/ws/node --token change-me-lab-token
```

## REST API (curl)

```bash
# Health
curl http://localhost:8000/health

# List nodes
curl http://localhost:8000/api/nodes

# List missions (includes the 4 seeded presets)
curl http://localhost:8000/api/missions

# Create a custom mission
curl -X POST http://localhost:8000/api/missions \
  -H "Content-Type: application/json" \
  -d '{"name":"Basic Recon","description":"recon","steps":[{"plugin":"system_info","args":{}},{"plugin":"network_info","args":{}}],"target_node_ids":["node-001"]}'

# Start a mission on specific nodes
curl -X POST http://localhost:8000/api/missions/mission-lab-health-check/start \
  -H "Content-Type: application/json" \
  -d '{"target_node_ids":["node-001","node-002"]}'

# One-click demo: run sample mission across connected nodes
curl -X POST http://localhost:8000/api/demo/start-sample-mission

# Quick ad-hoc task
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"node_id":"node-001","plugin":"health_check","args":{}}'

# Ledger
curl http://localhost:8000/api/ledger/events
curl -X POST http://localhost:8000/api/ledger/events/<EVENT_ID>/verify
```

## Tests

```bash
cd server && python -m pytest -q
cd blockchain && npx hardhat test
cd frontend && npm run lint   # tsc --noEmit
```

## Safety demonstrations (expected to be rejected/contained)

```bash
# Non-allowlisted command -> result status "failed"
curl -X POST http://localhost:8000/api/tasks -H "Content-Type: application/json" \
  -d '{"node_id":"node-001","plugin":"allowed_command","args":{"command":"rm"}}'

# Path traversal -> result status "failed" (sandbox enforced)
curl -X POST http://localhost:8000/api/tasks -H "Content-Type: application/json" \
  -d '{"node_id":"node-001","plugin":"list_lab_directory","args":{"path":"../../"}}'

# Unknown plugin -> rejected at validation (HTTP 422)
curl -X POST http://localhost:8000/api/tasks -H "Content-Type: application/json" \
  -d '{"node_id":"node-001","plugin":"definitely_not_allowed","args":{}}'
```
