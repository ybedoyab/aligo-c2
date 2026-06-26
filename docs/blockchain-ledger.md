# Proof-of-Execution Ledger

The headline innovation: every meaningful event in an operation is turned into a
tamper-evident record. The full event lives in the database; a compact cryptographic
fingerprint is anchored on a private blockchain. Anyone can later re-verify that the stored
results were not altered.

## Why blockchain adds value here

A normal C2 stores results in a database the operator fully controls — so an operator (or
an attacker who compromises the server) could quietly rewrite history. By anchoring a
SHA-256 hash of each event on an append-only chain:

- **Tamper evidence**: changing a stored result changes its recomputed hash, which no longer
  matches the immutable on-chain value → flagged `tampered`.
- **Independent verifiability**: the chain is a second source of truth, separate from the
  application database.
- **Chain-of-custody**: `previous_hash` links events into an ordered, append-only sequence,
  so removing or reordering events is detectable.

It is a clean, demonstrable fit for "prove this operation wasn't altered."

## On-chain vs off-chain

| Stored on-chain (`ExecutionLedger.sol`) | Stored off-chain (DB) |
|------------------------------------------|------------------------|
| `eventId` | Full canonical payload (the exact hashed dict) |
| `missionId`, `taskId`, `nodeId` | `stdout`, `stderr`, metadata |
| `eventType` | `tx_hash`, `block_number`, `onchain_status` |
| `payloadHash` (bytes32) | Timestamps, sequence |
| `previousHash` (bytes32) | |
| `timestamp` (uint256) | |

No raw output, hostnames-as-secrets, or sensitive data are written on-chain — only hashes
and minimal routing metadata.

## How the hash is computed

1. Build a canonical event dict ([`ledger_service.build_canonical_payload`](../server/app/services/ledger_service.py)):

   ```json
   {
     "event_id": "evt-000007-a1b2c3d4",
     "sequence": 7,
     "event_type": "TASK_RESULT",
     "mission_id": "mission-lab-health-check",
     "task_id": "task-abc123",
     "node_id": "node-001",
     "data": { "status": "success", "exit_code": 0, "duration_ms": 42, "stdout": "..." },
     "previous_hash": "…64 hex…",
     "timestamp": "2026-06-26T10:01:01.500Z"
   }
   ```

2. Serialize to **canonical JSON** — keys sorted, no insignificant whitespace, UTF-8
   ([`core/hashing.py`](../server/app/core/hashing.py)).
3. Compute `SHA-256` over the UTF-8 bytes → 64-hex `payload_hash`.
4. Convert to `bytes32` and call `registerEvent(...)` on the contract.

Because the canonical form is deterministic, the hash is exactly reproducible during
verification.

## Chain status

`GET /api/ledger/status` returns a structured status for the UI:

| Status | Meaning |
|--------|---------|
| `connected` | RPC reachable, contract configured, client ready |
| `contract_not_configured` | `CONTRACT_ADDRESS` empty and no `deployment.json` |
| `disconnected` | Contract set but RPC unreachable |
| `local_only` | `LEDGER_ENABLED=false` |

The server also loads `CONTRACT_ADDRESS` from repo-root `deployment.json` (written by
`npx hardhat run scripts/deploy.ts`) when `.env` is empty. **Restart the server** after
deploying or changing the address.

## Anchoring pending events

Events created while the chain was down stay `pending_chain`. Retry with:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ledger/events/{event_id}/anchor` | Anchor one event |
| `POST /api/ledger/anchor-pending` | Anchor all pending (up to 50, oldest first) |

The **Ledger** page and **Demo** page expose **Anchor pending events** for the jury.

On success, `onchain_status` becomes `anchored`, with `tx_hash` and `block_number` stored.

## How verification works

`POST /api/ledger/events/{event_id}/verify`:

1. Load the event and **recompute** the hash from its stored canonical payload.
2. `local_match` = recomputed hash == stored hash (detects DB tampering).
3. Read the on-chain hash via `getEvent` / `verifyEventHash`.
4. `chain_match` = stored hash == on-chain hash (detects divergence from the chain).
5. Verdict:
   - both match → **verified**
   - recomputed ≠ stored, or stored ≠ on-chain → **tampered**
   - not anchored yet (chain disabled/unreachable) → **pending_chain** (locally consistent)

## Smart contract

[`blockchain/contracts/ExecutionLedger.sol`](../blockchain/contracts/ExecutionLedger.sol):

- `struct LedgerEvent { eventId, missionId, taskId, nodeId, eventType, payloadHash, previousHash, timestamp }`
- `mapping(string => LedgerEvent) eventsById;` and `string[] eventIds;`
- `event LedgerEventRegistered(...)`
- `registerEvent(...)` — reverts on duplicate `eventId`.
- `getEvent(eventId)`, `getEventCount()`, `getEventIdAt(index)`.
- `verifyEventHash(eventId, payloadHash) → bool` — `false` for unknown ids (never reverts).

## Example: register → verify

```text
1) TASK_RESULT event created
   payload_hash = 9f2c…ab12
   previous_hash = 4d77…0e9a
   tx 0xabc… mined in block #12  → onchain_status = anchored

2) Operator clicks "Verify"
   recompute(payload) = 9f2c…ab12      (== stored)      local_match  = true
   on-chain hash       = 9f2c…ab12      (== stored)      chain_match  = true
   => verified ✅

3) Someone edits the stored stdout in the DB
   recompute(payload) = 7b01…ff44       (≠ stored 9f2c…)
   => tampered ❌  (local_match = false)
```

## Limitations

- The local Hardhat chain is for demonstration; it is not a public, decentralized ledger.
- Anchoring is best-effort and synchronous per event; under heavy load you'd batch or queue.
- The server holds the signing key; in a real system you'd separate the anchoring role and
  protect the key with an HSM/KMS. See [limitations.md](limitations.md).
