"""Mission persistence and orchestration logic (DB-side only)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.enums import EventType, MissionStatus, TaskStatus
from app.models.mission import Mission
from app.models.node import Node
from app.models.task import Task
from app.schemas.mission import MissionCreate
from app.services import ledger_service, policy_service, task_service


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_mission(session: Session, payload: MissionCreate) -> Mission:
    mission = Mission(
        id=f"mission-{uuid.uuid4().hex[:12]}",
        name=payload.name,
        description=payload.description,
        status=MissionStatus.DRAFT,
        steps=[step.model_dump() for step in payload.steps],
        target_node_ids=payload.target_node_ids,
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
    session: Session, mission_id: str, target_node_ids: list[str]
) -> tuple[Mission, list[Task]]:
    """Mark a mission running and generate one task per (step x target node)."""
    mission = session.get(Mission, mission_id)
    if mission is None:
        raise ValueError(f"mission {mission_id} not found")
    if not target_node_ids:
        raise ValueError("at least one target node is required")

    mission.status = MissionStatus.RUNNING
    mission.started_at = _utcnow()
    mission.target_node_ids = target_node_ids
    session.add(mission)
    session.commit()

    tasks: list[Task] = []
    for node_id in target_node_ids:
        node = session.get(Node, node_id)
        for step in mission.steps:
            plugin = step["plugin"]
            args = step.get("args", {})
            task = task_service.create_task(
                session,
                mission_id=mission.id,
                node_id=node_id,
                plugin=plugin,
                args=args,
            )
            if node is None or not node.enabled or not policy_service.plugin_allowed(
                node, plugin
            ):
                task_service.set_status(session, task.id, TaskStatus.BLOCKED_BY_POLICY)
                ledger_service.record_event(
                    session,
                    event_type=EventType.PLUGIN_BLOCKED,
                    mission_id=mission.id,
                    task_id=task.id,
                    node_id=node_id,
                    data={
                        "plugin": plugin,
                        "policy_id": node.policy_id if node else "unknown",
                        "reason": "plugin not allowed by node policy",
                    },
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

    terminal = {TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.TIMEOUT, TaskStatus.BLOCKED_BY_POLICY}
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
