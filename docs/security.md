# Security Model

Aligo Mission Ledger C2 is built for an **authorized, closed laboratory**. Security here
means *containment and auditability* of a teaching/demo tool, not production hardening.

## Lab threat model

We assume a controlled environment with trusted operators on an isolated network. The
properties we care about:

- **Containment**: an agent must not be turned into a general remote shell.
- **Integrity/auditability**: results cannot be silently altered after the fact.
- **Robustness**: malformed input must not crash or hang the server.
- **Least surprise**: the operator cannot accidentally run arbitrary code on hosts.

Out of scope (explicitly NOT addressed): nation-state adversaries, untrusted networks
without TLS, multi-tenant isolation, key management at scale, and anything offensive.

## Key security decisions

### No arbitrary shell (by design)

There is **no** code path that executes operator-supplied shell strings. Agents only run
functions from a fixed plugin registry
([`agent/plugins/__init__.py`](../agent/plugins/__init__.py)). Even `allowed_command` does
not spawn a shell: it matches a name against a hard-coded allowlist and runs a native,
deterministic implementation.

### Plugin allowlist (defense in depth)

The allowlist is enforced in three places:

1. **Pydantic validation** on mission/task creation rejects any non-allowlisted plugin
   (`ALLOWED_PLUGINS` in [`core/enums.py`](../server/app/core/enums.py)).
2. **Agent registry** only maps known plugin names to functions; anything else returns a
   `failed` result.
3. **`allowed_command` internal allowlist**: only `whoami`, `hostname`, `pwd`, `date`.

### Path traversal protection

`list_lab_directory` resolves the requested path against the sandbox root and rejects any
target that is not the root or a descendant of it, blocking `../` traversal and absolute
paths ([`list_lab_directory.py`](../agent/plugins/list_lab_directory.py)). Covered by a
test that asserts traversal raises.

### Input validation & limits

- All REST bodies and WebSocket payloads are validated with Pydantic schemas.
- WebSocket frames are size-capped (`MAX_WS_MESSAGE_BYTES`).
- Each task has an execution timeout on the agent (`AGENT_TASK_TIMEOUT`, default 30s),
  returning `status=timeout` instead of hanging.

### Agent authentication token

Agents present `AGENT_SHARED_TOKEN` in their `register` message. The server compares it in
constant time ([`core/security.py`](../server/app/core/security.py)). This is a simple
lab gate, **not** a substitute for PKI / mutual TLS (see Limitations).

### CORS

CORS is restricted to the configured frontend origin(s) (`FRONTEND_URL` plus localhost
variants) in [`main.py`](../server/app/main.py), not `*` with credentials in production
intent.

### Ledger integrity

Every important event is hashed (SHA-256 over canonical JSON), chained via `previous_hash`,
and anchored on-chain. Verification recomputes the hash and compares it with the on-chain
value, surfacing `verified` / `tampered`. See [blockchain-ledger.md](blockchain-ledger.md).

## Known limits

- The shared token is symmetric and static; anyone with it can register an agent.
- No transport encryption is configured by default (intended for a trusted LAN/localhost).
- The blockchain private key in `.env.example` is a well-known public Hardhat key — for
  local demo only; never reuse it anywhere real.
- SQLite is single-writer; fine for a demo, swap to PostgreSQL for heavier use.

## What this project does NOT do

- No real malware, payloads, or implants.
- No evasion, stealth, obfuscation, or anti-analysis.
- No persistence mechanisms (registry/run keys, services, cron, startup hooks).
- No antivirus/EDR bypass.
- No real lateral movement, network scanning, or exploitation.
- No credential theft, dumping, or harvesting.
- No data exfiltration.
- No execution against systems outside the authorized lab.

If you need any of the above, this is the wrong tool — and that is intentional.
