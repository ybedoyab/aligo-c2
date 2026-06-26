# Limitations

A deliberately honest list of what this project is and isn't.

## Not for production

This is a hackathon/lab demonstrator. It has not undergone production hardening, load
testing, or a formal security audit. Do not deploy it to manage real systems.

## No offensive capabilities

By design, it does **not** implement: stealth/evasion, obfuscation, persistence
(registry/services/cron/startup), antivirus/EDR bypass, real lateral movement, network
scanning/exploitation, credential theft, or data exfiltration. The plugin set is
intentionally limited to safe, informational actions. This is a hard boundary, not a TODO.

## Blockchain is local/demo only

The ledger runs on a local Hardhat node for demonstration. It is not a public, decentralized
chain, and the trust assumptions differ accordingly. On-chain anchoring is best-effort and
performed synchronously per event; a production design would batch/queue anchoring and
separate the signing role behind an HSM/KMS. The signing key shipped in `.env.example` is a
well-known public Hardhat key — never reuse it.

**Hardhat resets wipe on-chain state.** Restarting the local chain clears all anchored events
while SQLite may still mark them `anchored`. On startup the server reconciles stale anchors
(`POST /api/ledger/sync`) and re-registers pending events. If the dashboard shows
`pending_chain` after a chain restart, run `python dev.py` once (it redeploys when bytecode
is missing) or call `/api/ledger/sync` manually.

## Transport encryption

With `python dev.py` (default), REST and WebSockets use **TLS/WSS** and a lab
self-signed certificate. Use `--no-tls` only for local debugging. Docker Compose still
defaults to plain HTTP unless you terminate TLS in front of the services.

## Simple token, not real PKI

Node authentication is a single shared, static token (`NODE_SHARED_TOKEN`) compared in
constant time. Anyone holding it can register an node. There is no per-node token rotation or mutual
TLS (certificates for client auth). Real deployments would use certificates / mTLS and
per-node keys.

## Plain HTTP in Docker / without dev.py

The default `docker compose` path does not enable TLS on the internal network. The lab
`dev.py` launcher does (HTTPS/WSS). Put a TLS terminator in front before any untrusted
network.

## SQLite by default

The default store is SQLite (single-writer). It's perfect for a demo; the code is
PostgreSQL-ready (`SQLModel` + `DATABASE_URL`) for heavier concurrency.

## Plugins limited by safety

Only six plugins exist, and `allowed_command` permits exactly four harmless commands. This
caps usefulness on purpose. Adding plugins means adding them to both the node registry and
the server allowlist.

## Operational scope

- In-memory connection state: node/operator sockets are tracked per-process, so the server
  is single-instance (no horizontal scaling/shared bus).
- The heartbeat monitor and anchoring run in-process; there is no external job system.
- Timeline replay and metrics are bounded to recent events for clarity.

## Ethics

Use only within a closed, controlled, and **authorized** laboratory. You are responsible for
ensuring you have explicit permission for any system you interact with.
