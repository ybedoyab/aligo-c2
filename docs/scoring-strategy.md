# Scoring Strategy

How Aligo Mission Ledger C2 maps to typical hackathon judging criteria.

## Technical innovation

- **Proof-of-Execution Ledger**: the differentiator. Canonical-JSON SHA-256 hashing +
  `previous_hash` chaining + on-chain anchoring + a one-click integrity check that surfaces
  `verified` / `tampered`. This reframes a C2 from "remote console" to "auditable,
  tamper-evident operations platform."
- Clean separation of on-chain (hashes + metadata) vs off-chain (full evidence).
- Real end-to-end crypto verification, not a mock: the same canonical form is reproduced at
  verify time and compared against the contract.

## Functionality

- End-to-end working MVP: server ⇄ nodes over WebSockets, mission orchestration,
  real-time results, and ledger anchoring/verification.
- Advanced features implemented: multi-node, heartbeat with warning/offline degradation,
  exponential-backoff reconnection, mission system with 4 presets, 6 safe plugins, live
  operator updates, timeline replay, simulated node fleet (`--simulate-count`).
- Full REST API + two WebSocket channels exactly as specified.

## Robustness

- Graceful degradation: runs even if the blockchain is down (`pending_chain`).
- Defensive WebSocket handling (size caps, JSON validation, structured errors).
- Per-task timeouts; offline-node tasks fail fast instead of hanging missions.
- Heartbeat monitor keeps node state honest.
- Automated tests for the riskiest logic (hashing, ledger, traversal, allowlist, contract).

## Code quality

- Python type hints throughout; Pydantic/SQLModel validation; services free of transport
  concerns; reusable, typed React components; Tailwind-only styling (no heavy UI deps).
- Clear module boundaries (`core`, `db`, `models`, `schemas`, `services`, `api`,
  `websocket`, `blockchain`). Comments explain intent, not the obvious.
- Backend tests pass; frontend type-checks and builds cleanly.

## Presentation & documentation

- Complete `docs/` set (architecture, protocol, security, ledger, deployment, demo,
  scoring, limitations) — no TODOs.
- SOC-style dashboard with a dedicated, jury-friendly **Demo** page and **Timeline Replay**.
- Timed [demo script](demo-script.md) and a ready-to-record [video script](../demo/video-script.md).

## Responsible-use posture

- Explicit, repeated lab-only framing; a deliberately constrained capability set
  (allowlist, no shell, sandboxed FS). This is a feature for defensive/educational judging,
  not a gap. See [security.md](security.md) and [limitations.md](limitations.md).

## Suggested emphasis during judging

1. Lead with the ledger verify (verified → tampered) — it's the memorable moment.
2. Show multi-node fan-out and live updates (no refresh).
3. Stress the safety model: this is auditable and contained by design.
