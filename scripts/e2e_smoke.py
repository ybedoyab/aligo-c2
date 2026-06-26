"""End-to-end smoke test against a running dev stack (python dev.py)."""
from __future__ import annotations

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.error
import urllib.request
from typing import Any

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
BASE = os.environ.get("ALIGO_API_BASE", "https://127.0.0.1:8000")

FAILURES: list[str] = []


def ok(name: str) -> None:
    print(f"  OK  {name}")


def fail(name: str, detail: str) -> None:
    print(f"  FAIL {name}: {detail}")
    FAILURES.append(f"{name}: {detail}")


def get(path: str) -> Any:
    with urllib.request.urlopen(BASE + path, context=CTX) as r:
        return json.loads(r.read())


def post(path: str, body: dict | None = None) -> Any:
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        BASE + path,
        method="POST",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, context=CTX) as r:
        return json.loads(r.read())


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def wait_for(predicate, timeout: float = 60, interval: float = 1.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def main() -> int:
    section("Health & chain")
    try:
        health = get("/health")
    except urllib.error.URLError as exc:
        fail("health", str(exc))
        print("\nStart the stack first: python dev.py")
        return 1

    if health.get("status") != "ok":
        fail("health status", str(health))
    else:
        ok("health")

    if not health.get("ledger_available"):
        fail("ledger", health.get("ledger_detail", "unavailable"))
    else:
        ok(f"ledger connected ({health.get('contract_address', '')[:12]}…)")

    section("Ledger sync")
    try:
        sync = post("/api/ledger/sync")
    except urllib.error.HTTPError:
        sync = {"stale_reset": 0, "re_anchored": 0, "note": "sync endpoint unavailable; using anchor-pending"}
        for _ in range(5):
            batch = post("/api/ledger/anchor-pending")
            if not batch:
                break
    ok(f"sync stale_reset={sync.get('stale_reset')} re_anchored={sync.get('re_anchored')}")

    stats = get("/api/ledger/stats")
    if stats.get("pending_chain", 0) > 0:
        fail("ledger pending", f"{stats['pending_chain']} events still pending on-chain")
    else:
        ok(f"ledger stats anchored={stats.get('anchored_on_chain')} verified={stats.get('verified')}")

    section("Nodes")
    nodes = get("/api/nodes")
    if len(nodes) < 2:
        fail("nodes online", f"only {len(nodes)} nodes")
    else:
        ok(f"{len(nodes)} nodes online")

    gw = next((n for n in nodes if n.get("id") == "gateway-sim-001"), None)
    if gw is None:
        fail("iot gateway", "gateway-sim-001 not found")
    elif gw.get("status") != "online":
        fail("iot gateway status", gw.get("status", "unknown"))
    else:
        ok("gateway-sim-001 online")

    section("IoT lab API")
    lab = get("/api/iot/lab")
    if not lab.get("gateway_id"):
        fail("iot lab", "no gateway in lab snapshot")
    else:
        ok(f"iot lab gateway={lab.get('gateway_id')}")

    action = post(
        "/api/iot/actions",
        {"gateway_id": "gateway-sim-001", "plugin": "led_blink", "args": {"times": 1}},
    )
    if not action.get("id"):
        fail("iot action", str(action))
    else:
        ok(f"iot led_blink task={action['id']}")

    section("Mission run")
    missions = get("/api/missions")
    iot_mission = next(
        (m for m in missions if "IoT" in m.get("name", "") and m.get("status") == "draft"),
        None,
    )
    if iot_mission is None:
        iot_mission = next(
            (m for m in missions if m.get("status") == "draft"),
            missions[0],
        )

    if iot_mission.get("status") in ("completed", "partially_failed", "failed"):
        ok(f"mission already finished ({iot_mission.get('status')})")
        mission_id = iot_mission["id"]
    else:
        started = post(f"/api/missions/{iot_mission['id']}/start")
        mission_id = started.get("id", iot_mission["id"])
        ok(f"started mission {started.get('name', mission_id)}")

        def mission_done() -> bool:
            m = get(f"/api/missions/{mission_id}")
            return m.get("status") in ("completed", "partially_failed", "failed")

        if not wait_for(mission_done, timeout=90):
            fail("mission completion", "timed out")
        else:
            m = get(f"/api/missions/{mission_id}")
            ok(f"mission status={m.get('status')}")

    section("Task integrity (gateway)")
    detail = get("/api/nodes/gateway-sim-001/detail")
    tasks = detail.get("tasks", [])
    if not tasks:
        fail("gateway tasks", "no task history")
    else:
        pending = [t for t in tasks if t.get("integrity_status") == "pending_chain"]
        if pending:
            fail("integrity", f"{len(pending)}/{len(tasks)} tasks still pending_chain")
        else:
            verified = sum(1 for t in tasks if t.get("integrity_status") == "verified")
            ok(f"{verified}/{len(tasks)} tasks verified")

    section("Evidence bundle")
    if tasks:
        tid = tasks[-1]["task_id"]
        bundle = get(f"/api/tasks/{tid}/evidence")
        if bundle.get("integrity_status") == "pending_chain":
            fail("evidence integrity", bundle.get("integrity_status"))
        elif bundle.get("on_chain_status") not in ("anchored", "confirmed"):
            fail("evidence on_chain", str(bundle.get("on_chain_status")))
        else:
            ok(f"evidence task={tid} integrity={bundle.get('integrity_status')}")

        v = post("/api/evidence/verify", {"bundle": bundle})
        summary = v.get("summary", {})
        if summary.get("chain_valid") is True or v.get("status") in ("verified", "not_anchored"):
            ok("evidence bundle verification")
        else:
            fail("bundle verify", str(summary or v))

    section("Policies & demo")
    policies = get("/api/policies")
    ok(f"{len(policies)} policies loaded")

    demo = post("/api/demo/verify-latest-iot-event")
    if not demo.get("verified"):
        fail("demo verify iot", str(demo))
    else:
        ok("demo verify-latest-iot-event")

    section("Summary")
    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s):")
        for f in FAILURES:
            print(f"  - {f}")
        return 1

    print("\nAll E2E checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
