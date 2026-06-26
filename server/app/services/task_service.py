"""Task persistence logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.core.enums import TaskStatus
from app.models.task import Task


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_task_id() -> str:
    return f"task-{uuid.uuid4().hex[:12]}"


def create_task(
    session: Session,
    *,
    mission_id: str,
    agent_id: str,
    plugin: str,
    args: dict[str, Any] | None = None,
) -> Task:
    task = Task(
        id=new_task_id(),
        mission_id=mission_id,
        agent_id=agent_id,
        plugin=plugin,
        args=args or {},
        status=TaskStatus.PENDING,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def mark_sent(session: Session, task_id: str) -> Task | None:
    task = session.get(Task, task_id)
    if task is None:
        return None
    task.status = TaskStatus.SENT
    task.sent_at = _utcnow()
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def set_status(session: Session, task_id: str, status: TaskStatus) -> Task | None:
    task = session.get(Task, task_id)
    if task is None:
        return None
    task.status = status
    if status in {TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.TIMEOUT}:
        task.completed_at = _utcnow()
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def get_task(session: Session, task_id: str) -> Task | None:
    return session.get(Task, task_id)


def list_tasks(
    session: Session, mission_id: str | None = None, limit: int = 200
) -> list[Task]:
    statement = select(Task).order_by(Task.created_at.desc()).limit(limit)
    if mission_id:
        statement = (
            select(Task)
            .where(Task.mission_id == mission_id)
            .order_by(Task.created_at.desc())
            .limit(limit)
        )
    return list(session.exec(statement).all())


def list_tasks_for_mission(session: Session, mission_id: str) -> list[Task]:
    return list(
        session.exec(select(Task).where(Task.mission_id == mission_id)).all()
    )
