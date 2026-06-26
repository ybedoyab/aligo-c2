"""Task REST endpoints (including the dashboard's 'quick task' button)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.enums import EventType, PolicyDecision, TaskStatus
from app.db.database import get_session
from app.schemas.task import EvidenceBundleRead, TaskCreate, TaskEvidenceRead, TaskRead
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
) -> dict:
    """Validate node state and policy; emit POLICY_BLOCKED audit event when denied."""
    node = node_service.get_node(session, node_id)
    decision = policy_service.evaluate_policy(
        node, plugin, node_id=node_id, require_online=False
    )
    if decision["decision"] == str(PolicyDecision.ALLOW):
        return decision

    task = task_service.create_task(
        session,
        mission_id=mission_id,
        node_id=node_id,
        plugin=plugin,
        args=args or {},
    )
    task_service.set_policy_decision(session, task.id, decision)
    task_service.set_status(session, task.id, TaskStatus.BLOCKED_BY_POLICY)
    await notifier.emit_event(
        event_type=EventType.POLICY_BLOCKED,
        mission_id=mission_id,
        task_id=task.id,
        node_id=node_id,
        data={
            "plugin": plugin,
            "policy_id": decision.get("policy_id"),
            "reason": decision.get("reason"),
            "policy_decision": decision,
        },
    )
    raise HTTPException(
        status_code=403,
        detail={
            "message": "plugin blocked by node policy",
            "plugin": plugin,
            "policy_id": decision.get("policy_id"),
            "task_id": task.id,
            "policy_decision": decision,
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
    decision = await _guard_node_task(
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
    task_service.set_policy_decision(session, task.id, decision)
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


@router.get("/{task_id}/evidence/bundle", response_model=EvidenceBundleRead)
def get_evidence_bundle(
    task_id: str, session: Session = Depends(get_session)
) -> EvidenceBundleRead:
    bundle = evidence_service.build_evidence_bundle(session, task_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="task not found")
    return bundle


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: str, session: Session = Depends(get_session)) -> TaskRead:
    task = task_service.get_task(session, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return TaskRead.model_validate(task)
