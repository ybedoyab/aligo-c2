"""Demo helper endpoints for the jury-facing Demo page."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.enums import EventType
from app.db.database import get_session
from app.schemas.mission import MissionRead
from app.schemas.task import TaskRead
from app.services import mission_service
from app.websocket import dispatch, notifier
from app.websocket.manager import manager

router = APIRouter(prefix="/api/demo", tags=["demo"])

SAMPLE_MISSION_ID = "mission-lab-health-check"


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
