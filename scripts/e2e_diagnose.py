"""Quick diagnostic against a running dev stack."""
from __future__ import annotations

import json
import ssl
import urllib.request

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
BASE = "https://127.0.0.1:8000"


def get(path: str) -> dict | list:
    with urllib.request.urlopen(BASE + path, context=CTX) as r:
        return json.loads(r.read())


def post(path: str) -> dict:
    req = urllib.request.Request(
        BASE + path,
        method="POST",
        data=b"{}",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, context=CTX) as r:
        return json.loads(r.read())


def main() -> None:
    print("HEALTH:", json.dumps(get("/health"), indent=2))

    detail = get("/api/nodes/gateway-sim-001/detail")
    tasks = detail.get("tasks", [])[:8]
    print("\nGATEWAY TASKS:")
    for t in tasks:
        print(
            f"  {t.get('task_id', t.get('id'))} plugin={t.get('plugin')} "
            f"integrity={t.get('integrity_status')}"
        )

    events = get("/api/ledger/events?limit=15")
    print("\nLEDGER VERIFY (recent):")
    for e in events[:15]:
        vid = e["id"]
        v = post(f"/api/ledger/events/{vid}/verify")
        oh = v.get("onchain_hash")
        oh_short = (oh[:22] + "...") if oh else None
        print(
            f"  {vid} {e.get('event_type')} onchain={e.get('onchain_status')} "
            f"verify={v.get('status')} chain_match={v.get('chain_match')} hash={oh_short}"
        )


if __name__ == "__main__":
    main()
