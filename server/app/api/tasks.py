"""Task REST endpoints (including the dashboard's 'quick task' button)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.enums import EventType, TaskStatus
from app.db.database import get_session
from app.schemas.task import TaskCreate, TaskEvidenceRead, TaskRead
from app.services import evidence_service, node_service, policy_service, task_service
from app.websocket import dispatch, notifier

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

ADHOC_MISSION_ID = "mission-adhoc"


async def _guard_node_task(
    session: Session,
    *,
    node_id: str,
    plugin: str,
    mission_id: str,
    args: dict | None = None,
) -> None:
    """Validate node state and policy; emit PLUGIN_BLOCKED audit event when denied."""
    node = node_service.get_node(session, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="node not found")
    if not node.enabled:
        raise HTTPException(status_code=403, detail="node is disabled in registry")
    if policy_service.plugin_allowed(node, plugin):
        return

    task = task_service.create_task(
        session,
        mission_id=mission_id,
        node_id=node_id,
        plugin=plugin,
        args=args or {},
    )
    task_service.set_status(session, task.id, TaskStatus.BLOCKED_BY_POLICY)
    await notifier.emit_event(
        event_type=EventType.PLUGIN_BLOCKED,
        mission_id=mission_id,
        task_id=task.id,
        node_id=node_id,
        data={
            "plugin": plugin,
            "policy_id": node.policy_id,
            "reason": "plugin not allowed by node policy",
        },
    )
    raise HTTPException(
        status_code=403,
        detail={
            "message": "plugin blocked by node policy",
            "plugin": plugin,
            "policy_id": node.policy_id,
            "task_id": task.id,
        },
    )


@router.get("", response_model=list[TaskRead])
def list_tasks(
    mission_id: str | None = None,
    node_id: str | None = None,
    session: Session = Depends(get_session),
) -> list[TaskRead]:
    return [
        TaskRead.model_validate(t)
        for t in task_service.list_tasks(session, mission_id, node_id)
    ]


@router.post("", response_model=TaskRead, status_code=201)
async def create_task(
    payload: TaskCreate, session: Session = Depends(get_session)
) -> TaskRead:
    mission_id = payload.mission_id or ADHOC_MISSION_ID
    await _guard_node_task(
        session,
        node_id=payload.node_id,
        plugin=payload.plugin,
        mission_id=mission_id,
        args=payload.args,
    )

    task = task_service.create_task(
        session,
        mission_id=mission_id,
        node_id=payload.node_id,
        plugin=payload.plugin,
        args=payload.args,
    )
    view = TaskRead.model_validate(task)
    await dispatch.dispatch_task(task.id)
    return view


@router.get("/{task_id}/evidence", response_model=TaskEvidenceRead)
def get_task_evidence(
    task_id: str, session: Session = Depends(get_session)
) -> TaskEvidenceRead:
    evidence = evidence_service.build_task_evidence(session, task_id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="task not found")
    return evidence


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: str, session: Session = Depends(get_session)) -> TaskRead:
    task = task_service.get_task(session, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return TaskRead.model_validate(task)
