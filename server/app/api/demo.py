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


class TamperRequest(BaseModel):
    task_id: str = Field(min_length=1)
    note: str = Field(
        default="controlled demo tamper — local ledger copy modified, not live node output"
    )


@router.post("/start-sample-mission")
async def start_sample_mission(session: Session = Depends(get_session)) -> dict:
    """One-click: run the Lab Health Check across all connected nodes."""
    mission = mission_service.get_mission(session, SAMPLE_MISSION_ID)
    if mission is None:
        raise HTTPException(status_code=404, detail="sample mission not seeded")

    targets = manager.connected_node_ids()
    if not targets:
        raise HTTPException(status_code=400, detail="no nodes connected")

    mission, tasks = mission_service.start_mission(session, SAMPLE_MISSION_ID, targets)
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
    }
