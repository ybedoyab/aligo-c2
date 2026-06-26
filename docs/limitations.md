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

## Simple token, not real PKI

Agent authentication is a single shared, static token (`AGENT_SHARED_TOKEN`) compared in
constant time. Anyone holding it can register an agent. There is no per-agent identity,
rotation, or mutual TLS. Real deployments would use certificates / mTLS and per-agent keys.

## No transport encryption by default

WebSockets and REST run over plain HTTP/WS for a trusted localhost/LAN lab. Put a TLS
terminator in front (and use `wss://`/`https://`) before using any untrusted network.

## SQLite by default

The default store is SQLite (single-writer). It's perfect for a demo; the code is
PostgreSQL-ready (`SQLModel` + `DATABASE_URL`) for heavier concurrency.

## Plugins limited by safety

Only six plugins exist, and `allowed_command` permits exactly four harmless commands. This
caps usefulness on purpose. Adding plugins means adding them to both the agent registry and
the server allowlist.

## Operational scope

- In-memory connection state: agent/operator sockets are tracked per-process, so the server
  is single-instance (no horizontal scaling/shared bus).
- The heartbeat monitor and anchoring run in-process; there is no external job system.
- Timeline replay and metrics are bounded to recent events for clarity.

## Ethics

Use only within a closed, controlled, and **authorized** laboratory. You are responsible for
ensuring you have explicit permission for any system you interact with.
