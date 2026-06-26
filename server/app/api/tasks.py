"""Task REST endpoints (including the dashboard's 'quick task' button)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.task import TaskCreate, TaskRead
from app.services import agent_service, task_service
from app.websocket import dispatch

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# Ad-hoc tasks are grouped under a synthetic mission id for traceability.
ADHOC_MISSION_ID = "mission-adhoc"


@router.get("", response_model=list[TaskRead])
def list_tasks(
    mission_id: str | None = None, session: Session = Depends(get_session)
) -> list[TaskRead]:
    return [TaskRead.model_validate(t) for t in task_service.list_tasks(session, mission_id)]


@router.post("", response_model=TaskRead, status_code=201)
async def create_task(
    payload: TaskCreate, session: Session = Depends(get_session)
) -> TaskRead:
    if agent_service.get_agent(session, payload.agent_id) is None:
        raise HTTPException(status_code=404, detail="agent not found")

    task = task_service.create_task(
        session,
        mission_id=payload.mission_id or ADHOC_MISSION_ID,
        agent_id=payload.agent_id,
        plugin=payload.plugin,
        args=payload.args,
    )
    view = TaskRead.model_validate(task)
    await dispatch.dispatch_task(task.id)
    return view


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: str, session: Session = Depends(get_session)) -> TaskRead:
    task = task_service.get_task(session, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return TaskRead.model_validate(task)
