# ---------------------------------------------------------------------------
# Aligo Mission Ledger C2 - developer convenience targets
# ---------------------------------------------------------------------------
# These targets assume a Unix-like shell (Linux/macOS/WSL/Git Bash).
# On Windows PowerShell, run the underlying commands directly (see README).
# ---------------------------------------------------------------------------

.DEFAULT_GOAL := help
.PHONY: help dev server frontend blockchain deploy-contract agent demo test clean install

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (server, frontend, blockchain)
	cd server && python -m pip install -r requirements.txt
	cd agent && python -m pip install -r requirements.txt
	cd frontend && npm install
	cd blockchain && npm install

dev: ## Run the full stack with Docker Compose
	docker compose up --build

server: ## Run the FastAPI C2 server locally
	cd server && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

frontend: ## Run the React operator dashboard (Vite dev server)
	cd frontend && npm run dev

blockchain: ## Start the local Hardhat node
	cd blockchain && npx hardhat node

deploy-contract: ## Deploy ExecutionLedger.sol to the local node
	cd blockchain && npx hardhat run scripts/deploy.ts --network localhost

agent: ## Run a single agent (override with AGENT_ID=agent-002)
	cd agent && python agent.py --agent-id $(or $(AGENT_ID),agent-001)

demo: ## Launch a fleet of simulated agents
	cd agent && python agent.py --simulate-count 3

test: ## Run backend, agent and contract tests
	cd server && python -m pytest -q
	cd blockchain && npx hardhat test

clean: ## Remove build artifacts, caches and the local database
	rm -rf server/c2.db blockchain/artifacts blockchain/cache deployment.json
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf frontend/dist
