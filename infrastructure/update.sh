#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Aligo Mission Ledger C2 — in-place application update.
#
# Pulls the latest repo code and rebuilds/recreates ONLY the application
# services (server, frontend, nodes, and the optional agent), leaving the
# blockchain container untouched.
#
# WHY blockchain is excluded: the Hardhat node holds the deployed contract and
# all anchored ledger state IN MEMORY. Recreating it would drop the contract
# and leave every previously-anchored event stuck "pending_chain". The cloud
# startup script (startup.sh.tftpl) brings the chain up exactly once for this
# reason — this script honours the same contract.
#
# Run it ON THE VM, e.g.:
#   sudo /opt/aligo-c2/infrastructure/update.sh            # update current branch
#   sudo /opt/aligo-c2/infrastructure/update.sh main       # update a specific branch
#
# If you changed the blockchain/contract itself, this script is NOT the right
# tool — recreate the VM instead:
#   terraform apply -replace="google_compute_instance.this"
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR=/opt/aligo-c2
cd "$APP_DIR"

COMPOSE="docker compose -f docker-compose.yml -f infrastructure/docker-compose.cloud.yml"

# --- 1. Resolve the target branch ------------------------------------------
# Use the argument if given, otherwise stay on whatever branch is checked out.
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
echo "=== Aligo C2 update begin: $(date -u) — branch '$BRANCH' ==="

# --- 2. Guard: blockchain must already be running --------------------------
# If the chain is down we must NOT silently continue, because bringing it back
# up here would start a fresh, contract-less chain.
if ! docker inspect -f '{{.State.Running}}' aligo-blockchain >/dev/null 2>&1; then
  echo "ERROR: aligo-blockchain is not running. Refusing to update, as a"
  echo "       restart would start a fresh chain and orphan the ledger."
  echo "       For a clean redeploy use: terraform apply -replace=...instance.this"
  exit 1
fi

BEFORE_SHA="$(git rev-parse HEAD)"

# --- 3. Pull the latest code -----------------------------------------------
echo "Fetching origin/$BRANCH ..."
git fetch --depth 1 origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
AFTER_SHA="$(git rev-parse HEAD)"

if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  echo "Already up to date ($AFTER_SHA). Nothing to do."
  exit 0
fi
echo "Updated $BEFORE_SHA -> $AFTER_SHA"

# --- 4. Decide which services to touch -------------------------------------
# blockchain is deliberately absent from this list.
SERVICES="server frontend node-1 node-2"
PROFILE_ARGS=""
# If the agent is enabled (container present), include it under its profile.
if docker inspect aligo-agent >/dev/null 2>&1; then
  echo "Agent detected — it will be updated too."
  PROFILE_ARGS="--profile agent"
  SERVICES="$SERVICES agent"
fi

# --- 5. Rebuild images for those services (chain image left as-is) ---------
echo "Building images for: $SERVICES"
# shellcheck disable=SC2086
$COMPOSE $PROFILE_ARGS build $SERVICES

# --- 6. Recreate ONLY those services ---------------------------------------
# --no-deps is the critical flag: it stops compose from also recreating the
# blockchain dependency. --no-build because step 5 already built the images.
echo "Recreating services (blockchain untouched)..."
# shellcheck disable=SC2086
$COMPOSE $PROFILE_ARGS up -d --no-deps --no-build $SERVICES

# --- 7. Prune dangling images left over from the rebuild -------------------
docker image prune -f >/dev/null 2>&1 || true

echo "=== Aligo C2 update complete: $(date -u) ==="
$COMPOSE ps
