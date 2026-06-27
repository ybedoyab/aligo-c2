"""Phase 0 smoke test: exercise c2_client against a running C2 server.

No Anthropic key required — this only hits the C2 read endpoints to prove the
contract wiring. Start the C2 server first (see project README), then run:

    python smoke_test.py              # from agents/orchestrator/

It lists nodes, missions and ledger events and prints a short summary.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow running as a loose script from agents/orchestrator/ (so `app` is importable).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.c2_client import C2Client  # noqa: E402


async def main() -> int:
    c2 = C2Client()
    try:
        health = await c2.health()
        print(f"[health] {health.get('status')} · chain={health.get('chain_status')}")

        nodes = await c2.list_nodes()
        print(f"[nodes] {len(nodes)} known")
        for n in nodes[:5]:
            print(f"   - {n.get('id')}  status={n.get('status')}  health={n.get('health_score')}")

        missions = await c2.list_missions()
        print(f"[missions] {len(missions)} total")
        for m in missions[:5]:
            print(f"   - {m.get('id')}  {m.get('name')!r}  status={m.get('status')}")

        events = await c2.list_ledger_events()
        print(f"[ledger] {len(events)} events")

        print("\nOK — c2_client can read the live C2 contract.")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"\nFAILED: {exc!r}")
        print("Is the C2 server running at the configured C2_BASE_URL?")
        return 1
    finally:
        await c2.aclose()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
