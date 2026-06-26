"""Demo helper endpoints for the jury-facing Demo page."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.core.enums import EventType
from app.db.database import get_session
from app.schemas.mission import MissionRead
from app.schemas.task import TaskRead
from app.services import ledger_service, mission_service
from app.websocket import dispatch, notifier
from app.websocket.manager import manager

router = APIRouter(prefix="/api/demo", tags=["demo"])

SAMPLE_MISSION_ID = "mission-lab-health-check"
IOT_HEALTH_MISSION_ID = "mission-iot-lab-health"
IOT_ENV_MISSION_ID = "mission-iot-environmental"
DEFAULT_GATEWAY_ID = "gateway-sim-001"


class TamperRequest(BaseModel):
    task_id: str = Field(min_length=1)
    note: str = Field(
        default="controlled demo tamper — local ledger copy modified, not live node output"
    )


@router.post("/start-sample-mission")
async def start_sample_mission(session: Session = Depends(get_session)) -> dict:
    """One-click: run the Lab Health Check across all connected nodes."""
    return await _start_mission(session, SAMPLE_MISSION_ID)


async def _start_mission(
    session: Session, mission_id: str, targets: list[str] | None = None
) -> dict:
    mission = mission_service.get_mission(session, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail=f"mission {mission_id} not seeded")

    if targets is None:
        targets = manager.connected_node_ids()
    if not targets:
        raise HTTPException(status_code=400, detail="no nodes connected")

    mission, tasks = mission_service.start_mission(session, mission_id, targets)
    mission_view = MissionRead.model_validate(mission)
    task_ids = [t.id for t in tasks]
    task_views = [TaskRead.model_validate(t).model_dump(mode="json") for t in tasks]

    await notifier.emit_event(
        event_type=EventType.MISSION_STARTED,
        mission_id=mission.id,
        data={"targets": targets, "task_count": len(task_ids), "source": "demo"},
    )
    await notifier.broadcast(
        {"type": "mission_update", "data": mission_view.model_dump(mode="json")}
    )
    await dispatch.dispatch_tasks(task_ids)

    return {
        "mission": mission_view.model_dump(mode="json"),
        "tasks": task_views,
        "targets": targets,
    }


@router.post("/start-iot-health-check")
async def start_iot_health_check(session: Session = Depends(get_session)) -> dict:
    if DEFAULT_GATEWAY_ID not in manager.connected_node_ids():
        raise HTTPException(status_code=400, detail="IoT gateway not connected")
    return await _start_mission(session, IOT_HEALTH_MISSION_ID, [DEFAULT_GATEWAY_ID])


@router.post("/run-environmental-snapshot")
async def run_environmental_snapshot(session: Session = Depends(get_session)) -> dict:
    if DEFAULT_GATEWAY_ID not in manager.connected_node_ids():
        raise HTTPException(status_code=400, detail="IoT gateway not connected")
    return await _start_mission(session, IOT_ENV_MISSION_ID, [DEFAULT_GATEWAY_ID])


@router.post("/blink-led")
async def blink_led(session: Session = Depends(get_session)) -> dict:
    if DEFAULT_GATEWAY_ID not in manager.connected_node_ids():
        raise HTTPException(status_code=400, detail="IoT gateway not connected")
    from app.services import task_service

    task = task_service.create_task(
        session,
        mission_id="",
        node_id=DEFAULT_GATEWAY_ID,
        plugin="led_blink",
        args={"device_id": "led-001", "duration_ms": 2000, "interval_ms": 250},
    )
    await dispatch.dispatch_tasks([task.id])
    session.refresh(task)
    return {"task": TaskRead.model_validate(task).model_dump(mode="json")}


@router.post("/verify-latest-iot-event")
def verify_latest_iot_event(session: Session = Depends(get_session)) -> dict:
    from app.core.iot_plugins import IOT_PLUGINS
    from app.services import task_service

    tasks = task_service.list_tasks_for_node(session, DEFAULT_GATEWAY_ID)
    iot_tasks = [t for t in tasks if t.plugin in IOT_PLUGINS and t.status.value == "success"]
    if not iot_tasks:
        raise HTTPException(status_code=404, detail="no IoT task results yet")
    latest = sorted(iot_tasks, key=lambda t: t.completed_at or t.created_at)[-1]
    event = ledger_service.get_primary_result_event(session, latest.id)
    if event is None:
        raise HTTPException(status_code=404, detail="no ledger event for latest IoT task")
    verify = ledger_service.verify_event(session, event.id)
    return {
        "task_id": latest.id,
        "plugin": latest.plugin,
        "device_id": latest.args.get("device_id"),
        "ledger_event_id": event.id,
        "verify_status": verify.status if verify else "unknown",
        "verified": verify.verified if verify else False,
        "detail": verify.detail if verify else "",
        "diff": verify.diff if verify else [],
    }


@router.get("/export-iot-evidence")
def export_iot_evidence(session: Session = Depends(get_session)) -> dict:
    from app.core.iot_plugins import IOT_PLUGINS
    from app.services import evidence_service, task_service

    tasks = task_service.list_tasks_for_node(session, DEFAULT_GATEWAY_ID)
    iot_tasks = [t for t in tasks if t.plugin in IOT_PLUGINS]
    bundles = []
    for task in iot_tasks[:10]:
        bundle = evidence_service.build_evidence_bundle(session, task.id)
        if bundle:
            bundles.append(bundle.model_dump(mode="json"))
    return {"gateway": DEFAULT_GATEWAY_ID, "count": len(bundles), "evidence": bundles}


@router.post("/simulate-tamper")
def simulate_tamper(
    body: TamperRequest, session: Session = Depends(get_session)
) -> dict:
    """Lab-only: mutate a *local copy* of ledger evidence to demo integrity verification.

    Does not alter real node execution output — only the stored ledger payload hash
    chain becomes inconsistent, so Verify reports TAMPERED vs the on-chain anchor.
    """
    event = ledger_service.get_primary_result_event(session, body.task_id)
    if event is None:
        raise HTTPException(
            status_code=404,
            detail="no ledger result event for this task (run a mission first)",
        )
    if not event.tx_hash:
        raise HTTPException(
            status_code=400,
            detail="event is not anchored on-chain yet — anchor before tamper demo",
        )

    stored = ledger_service.get_event(session, event.id)
    if stored is None:
        raise HTTPException(status_code=404, detail="ledger event not found")

    mutated = dict(stored.payload)
    data = dict(mutated.get("data") or {})
    data["_demo_tamper"] = body.note
    data["stdout"] = (data.get("stdout") or "") + "\n[DEMO TAMPER SIMULATION]"
    mutated["data"] = data
    stored.payload = mutated
    session.add(stored)
    session.commit()

    verify = ledger_service.verify_event(session, event.id)
    return {
        "task_id": body.task_id,
        "ledger_event_id": event.id,
        "detail": body.note,
        "verify_status": verify.status if verify else "unknown",
        "verified": verify.verified if verify else False,
        "diff": verify.diff if verify else [],
    }
