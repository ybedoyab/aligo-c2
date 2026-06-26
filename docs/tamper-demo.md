# Tamper Demo (Controlled Lab)

A **safe, demo-only** endpoint simulates tampering with a **local copy** of stored result metadata — not the real node execution or on-chain record.

## Purpose

Demonstrate that integrity verification detects when local evidence diverges from the blockchain anchor.

## Flow

1. Run a mission and wait for a **successful** result.
2. Anchor the ledger event on-chain (**Demo → Anchor pending**).
3. Click **Demo → Simulate tamper (demo)**.
4. Open **Task Execution Evidence** → **Verify integrity**.
5. Status shows **`tampered`** — recalculated local hash ≠ on-chain hash.

## What changes

The demo endpoint mutates a **sandboxed local field** (e.g. stored stdout copy used for hash recomputation) so the chained hash no longer matches what was anchored.

**It does not:**

- Modify the node process
- Rewrite on-chain data
- Enable offensive capabilities

## API

```
POST /api/demo/simulate-tamper
Body: { "task_id": "<uuid>" }
```

Response includes `verify_status: "tampered"` when verification is run immediately.

## UI labels

The button is explicitly titled **Simulate tamper (demo)** with subtitle explaining it is a controlled integrity demonstration.

## Demo script

> "An attacker who could alter local logs without detection would undermine auditability. We simulate that in the lab — tamper a local copy, hit Verify, and the system flags **TAMPERED** because the hash chain no longer matches the immutable on-chain record."

## Recovery

Re-run the task or restore from untampered evidence export. For a clean slate, restart with a fresh DB (`python dev.py` resets schema when needed).
