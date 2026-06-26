"""Result persistence logic."""

from __future__ import annotations

import uuid

from sqlmodel import Session, select

from app.core.enums import TaskStatus
from app.models.result import Result
from app.schemas.result import ResultIn
from app.services import task_service


def save_result(session: Session, payload: ResultIn) -> Result:
    """Persist a result and update the owning task's status accordingly."""
    result = Result(
        id=f"res-{uuid.uuid4().hex[:12]}",
        task_id=payload.task_id,
        mission_id=payload.mission_id,
        agent_id=payload.agent_id,
        status=payload.status,
        stdout=payload.stdout,
        stderr=payload.stderr,
        exit_code=payload.exit_code,
        duration_ms=payload.duration_ms,
        result_metadata=payload.metadata,
    )
    session.add(result)
    session.commit()
    session.refresh(result)

    # Keep the task in sync with the reported outcome.
    task = task_service.get_task(session, payload.task_id)
    if task is not None:
        task_service.set_status(session, task.id, payload.status)

    return result


def list_results(
    session: Session, mission_id: str | None = None, limit: int = 200
) -> list[Result]:
    statement = select(Result).order_by(Result.created_at.desc()).limit(limit)
    if mission_id:
        statement = (
            select(Result)
            .where(Result.mission_id == mission_id)
            .order_by(Result.created_at.desc())
            .limit(limit)
        )
    return list(session.exec(statement).all())


def get_result_for_task(session: Session, task_id: str) -> Result | None:
    return session.exec(
        select(Result).where(Result.task_id == task_id)
    ).first()
