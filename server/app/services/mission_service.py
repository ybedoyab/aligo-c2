"""Mission persistence and orchestration logic (DB-side only)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.enums import MissionStatus, TaskStatus
from app.models.mission import Mission
from app.models.task import Task
from app.schemas.mission import MissionCreate
from app.services import task_service


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_mission(session: Session, payload: MissionCreate) -> Mission:
    mission = Mission(
        id=f"mission-{uuid.uuid4().hex[:12]}",
        name=payload.name,
        description=payload.description,
        status=MissionStatus.DRAFT,
        steps=[step.model_dump() for step in payload.steps],
        target_agent_ids=payload.target_agent_ids,
        is_predefined=False,
    )
    session.add(mission)
    session.commit()
    session.refresh(mission)
    return mission


def list_missions(session: Session) -> list[Mission]:
    return list(
        session.exec(select(Mission).order_by(Mission.created_at.desc())).all()
    )


def get_mission(session: Session, mission_id: str) -> Mission | None:
    return session.get(Mission, mission_id)


def start_mission(
    session: Session, mission_id: str, target_agent_ids: list[str]
) -> tuple[Mission, list[Task]]:
    """Mark a mission running and generate one task per (step x target agent)."""
    mission = session.get(Mission, mission_id)
    if mission is None:
        raise ValueError(f"mission {mission_id} not found")
    if not target_agent_ids:
        raise ValueError("at least one target agent is required")

    mission.status = MissionStatus.RUNNING
    mission.started_at = _utcnow()
    mission.target_agent_ids = target_agent_ids
    session.add(mission)
    session.commit()

    tasks: list[Task] = []
    for agent_id in target_agent_ids:
        for step in mission.steps:
            task = task_service.create_task(
                session,
                mission_id=mission.id,
                agent_id=agent_id,
                plugin=step["plugin"],
                args=step.get("args", {}),
            )
            tasks.append(task)
    session.refresh(mission)
    return mission, tasks


def recompute_status(session: Session, mission_id: str) -> Mission | None:
    """Update mission status from its tasks. Returns the mission if it changed."""
    mission = session.get(Mission, mission_id)
    if mission is None:
        return None

    tasks = task_service.list_tasks_for_mission(session, mission_id)
    if not tasks:
        return None

    terminal = {TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.TIMEOUT}
    if not all(t.status in terminal for t in tasks):
        # Still running.
        return None

    successes = sum(1 for t in tasks if t.status == TaskStatus.SUCCESS)
    failures = len(tasks) - successes

    if failures == 0:
        new_status = MissionStatus.COMPLETED
    elif successes == 0:
        new_status = MissionStatus.FAILED
    else:
        new_status = MissionStatus.PARTIALLY_FAILED

    if mission.status != new_status:
        mission.status = new_status
        mission.completed_at = _utcnow()
        session.add(mission)
        session.commit()
        session.refresh(mission)
        return mission
    return None
