"""Mission persistence, orchestration, and dry-run validation."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.core.enums import EventType, MissionStatus, PolicyDecision, TaskStatus
from app.models.mission import Mission
from app.models.node import Node
from app.models.task import Task
from app.schemas.mission import MissionCreate
from app.schemas.task import DryRunTaskItem, MissionDryRunRead
from app.services import ledger_service, policy_service, task_service
from app.websocket.manager import manager


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


def _record_policy_block(
    session: Session,
    *,
    mission_id: str,
    task: Task,
    node_id: str,
    decision: dict[str, Any],
) -> None:
    task_service.set_status(session, task.id, TaskStatus.BLOCKED_BY_POLICY)
    ledger_service.record_event(
        session,
        event_type=EventType.POLICY_BLOCKED,
        mission_id=mission_id,
        task_id=task.id,
        node_id=node_id,
        data={
            "plugin": task.plugin,
            "policy_id": decision.get("policy_id"),
            "reason": decision.get("reason"),
            "policy_decision": decision,
        },
    )


def dry_run_mission(
    session: Session, mission_id: str, target_node_ids: list[str]
) -> MissionDryRunRead | None:
    mission = session.get(Mission, mission_id)
    if mission is None:
        return None

    chain = ledger_service.get_chain_status()
    ledger_ok = chain.status.value == "connected"

    items: list[DryRunTaskItem] = []
    steps_with_node = any(s.get("node_id") for s in mission.steps)

    def _add_item(step_node_id: str, plugin: str) -> None:
        node = session.get(Node, step_node_id)
        decision = policy_service.evaluate_policy(
            node,
            plugin,
            node_id=step_node_id,
            require_online=True,
            require_trusted=True,
        )
        ready = decision["decision"] == str(PolicyDecision.ALLOW) and ledger_ok
        items.append(
            DryRunTaskItem(
                node_id=step_node_id,
                plugin=plugin,
                decision=decision["decision"],
                reason=decision["reason"],
                ready=ready,
            )
        )

    if steps_with_node:
        for step in mission.steps:
            step_node_id = step.get("node_id")
            if not step_node_id:
                continue
            _add_item(step_node_id, step["plugin"])
    else:
        for node_id in target_node_ids:
            for step in mission.steps:
                _add_item(node_id, step["plugin"])

    blocked = sum(1 for i in items if not i.ready)
    dispatchable = sum(1 for i in items if i.decision == str(PolicyDecision.ALLOW))
    ready = blocked == 0 and ledger_ok and bool(items)

    summary = (
        f"{dispatchable} task(s) allowed, {blocked} blocked"
        + ("" if ledger_ok else "; ledger not connected")
    )

    return MissionDryRunRead(
        mission_id=mission_id,
        ready=ready,
        tasks_to_dispatch=dispatchable,
        blocked_count=blocked,
        ledger_connected=ledger_ok,
        items=items,
        summary=summary,
    )


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
    steps_with_node = any(s.get("node_id") for s in mission.steps)

    def _enqueue_step(step_node_id: str, step: dict) -> None:
        node = session.get(Node, step_node_id)
        if node is None:
            raise ValueError(f"node {step_node_id} not found")
        plugin = step["plugin"]
        args = step.get("args", {})
        task = task_service.create_task(
            session,
            mission_id=mission.id,
            node_id=step_node_id,
            plugin=plugin,
            args=args,
        )
        decision = policy_service.evaluate_policy(
            node, plugin, node_id=step_node_id, require_online=False
        )
        task_service.set_policy_decision(session, task.id, decision)
        if decision["decision"] == str(PolicyDecision.BLOCK):
            _record_policy_block(
                session,
                mission_id=mission.id,
                task=task,
                node_id=step_node_id,
                decision=decision,
            )
        tasks.append(task)

    if steps_with_node:
        for step in mission.steps:
            step_node_id = step.get("node_id")
            if not step_node_id:
                raise ValueError("mission step missing node_id")
            _enqueue_step(step_node_id, step)
    else:
        for node_id in target_node_ids:
            for step in mission.steps:
                _enqueue_step(node_id, step)

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

    terminal = {
        TaskStatus.SUCCESS,
        TaskStatus.FAILED,
        TaskStatus.TIMEOUT,
        TaskStatus.BLOCKED_BY_POLICY,
    }
    if not all(t.status in terminal for t in tasks):
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
