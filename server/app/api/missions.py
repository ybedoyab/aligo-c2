"""Mission REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlmodel import Session

from app.core.enums import EventType
from app.db.database import get_session
from app.schemas.mission import MissionCreate, MissionRead, MissionStart
from app.schemas.task import TaskRead
from app.services import mission_service, report_service
from app.websocket import dispatch, notifier
from app.websocket.manager import manager

router = APIRouter(prefix="/api/missions", tags=["missions"])


@router.get("", response_model=list[MissionRead])
def list_missions(session: Session = Depends(get_session)) -> list[MissionRead]:
    return [MissionRead.model_validate(m) for m in mission_service.list_missions(session)]


@router.get("/{mission_id}", response_model=MissionRead)
def get_mission(mission_id: str, session: Session = Depends(get_session)) -> MissionRead:
    mission = mission_service.get_mission(session, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    return MissionRead.model_validate(mission)


@router.post("", response_model=MissionRead, status_code=201)
async def create_mission(
    payload: MissionCreate, session: Session = Depends(get_session)
) -> MissionRead:
    mission = mission_service.create_mission(session, payload)
    view = MissionRead.model_validate(mission)
    await notifier.emit_event(
        event_type=EventType.MISSION_CREATED,
        mission_id=mission.id,
        data={"name": mission.name, "steps": mission.steps},
    )
    await notifier.broadcast({"type": "mission_update", "data": view.model_dump(mode="json")})
    return view


@router.post("/{mission_id}/start")
async def start_mission(
    mission_id: str,
    body: MissionStart | None = None,
    session: Session = Depends(get_session),
) -> dict:
    mission = mission_service.get_mission(session, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")

    # Resolve targets: explicit body > mission default > all connected nodes.
    targets: list[str] = []
    if body and body.target_node_ids:
        targets = body.target_node_ids
    elif mission.target_node_ids:
        targets = mission.target_node_ids
    else:
        targets = manager.connected_node_ids()

    if not targets:
        raise HTTPException(
            status_code=400, detail="no target nodes (none connected and none specified)"
        )

    mission, tasks = mission_service.start_mission(session, mission_id, targets)
    mission_view = MissionRead.model_validate(mission)
    task_views = [TaskRead.model_validate(t) for t in tasks]
    task_ids = [t.id for t in tasks]

    await notifier.emit_event(
        event_type=EventType.MISSION_STARTED,
        mission_id=mission.id,
        data={"targets": targets, "task_count": len(task_ids)},
    )
    await notifier.broadcast(
        {"type": "mission_update", "data": mission_view.model_dump(mode="json")}
    )

    await dispatch.dispatch_tasks(task_ids)

    return {
        "mission": mission_view.model_dump(mode="json"),
        "tasks": [t.model_dump(mode="json") for t in task_views],
    }


@router.get("/{mission_id}/report")
def export_mission_report(
    mission_id: str,
    format: str = Query(default="json", pattern="^(json|markdown)$"),
    save: bool = Query(default=False),
    session: Session = Depends(get_session),
):
    """Export a mission report as JSON or Markdown. Optionally persist under demo/reports/."""
    report = report_service.build_mission_report(session, mission_id)
    if report is None:
        raise HTTPException(status_code=404, detail="mission not found")
    saved = report_service.save_report_files(session, mission_id) if save else None
    if format == "markdown":
        body = report_service.report_to_markdown(report)
        return PlainTextResponse(
            content=body,
            media_type="text/markdown",
            headers={"X-Report-Saved": str(saved) if saved else ""},
        )
    payload = {"report": report, "saved_paths": saved}
    return JSONResponse(content=payload)
