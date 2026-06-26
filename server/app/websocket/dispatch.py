"""Dispatch tasks to connected nodes over WebSocket and record ledger events."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlmodel import Session

from app.core.enums import EventType, PolicyDecision, TaskStatus
from app.db.database import engine
from app.schemas.task import TaskRead
from app.services import ledger_service, node_service, policy_service, task_service
from app.websocket import notifier
from app.websocket.manager import manager

logger = logging.getLogger("aligo.dispatch")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _block_task(session: Session, task, decision: dict) -> None:
    task_service.set_status(session, task.id, TaskStatus.BLOCKED_BY_POLICY)
    ledger_service.record_event(
        session,
        event_type=EventType.POLICY_BLOCKED,
        mission_id=task.mission_id,
        task_id=task.id,
        node_id=task.node_id,
        data={
            "plugin": task.plugin,
            "policy_id": decision.get("policy_id"),
            "reason": decision.get("reason"),
            "policy_decision": decision,
        },
    )


async def dispatch_task(task_id: str) -> bool:
    """Send a single task to its node. Marks it failed if the node is offline."""
    with Session(engine) as session:
        task = task_service.get_task(session, task_id)
        if task is None:
            return False
        if task.status == TaskStatus.BLOCKED_BY_POLICY:
            return False

        node = node_service.get_node(session, task.node_id)
        decision = task.policy_decision or policy_service.evaluate_policy(
            node, task.plugin, node_id=task.node_id, require_online=True
        )
        if not task.policy_decision:
            task_service.set_policy_decision(session, task.id, decision)
        if decision["decision"] == str(PolicyDecision.BLOCK):
            _block_task(session, task, decision)
            return False

        task_view = TaskRead.model_validate(task).model_dump(mode="json")

    node_id = task_view["node_id"]
    message = {
        "type": "task",
        "task_id": task_view["id"],
        "mission_id": task_view["mission_id"],
        "plugin": task_view["plugin"],
        "args": task_view["args"],
        "timestamp": _now_iso(),
    }

    delivered = await manager.send_to_node(node_id, message)

    if delivered:
        with Session(engine) as session:
            task = task_service.mark_sent(session, task_id)
            task_view = TaskRead.model_validate(task).model_dump(mode="json")
        await notifier.emit_event(
            event_type=EventType.TASK_SENT,
            mission_id=task_view["mission_id"],
            task_id=task_view["id"],
            node_id=node_id,
            data={"plugin": task_view["plugin"], "args": task_view["args"]},
        )
        await notifier.broadcast({"type": "task_update", "data": task_view})
        return True

    with Session(engine) as session:
        task = task_service.set_status(session, task_id, TaskStatus.FAILED)
        task_view = TaskRead.model_validate(task).model_dump(mode="json")
    await notifier.emit_event(
        event_type=EventType.TASK_FAILED,
        mission_id=task_view["mission_id"],
        task_id=task_view["id"],
        node_id=node_id,
        data={"reason": "node not connected"},
    )
    await notifier.broadcast({"type": "task_update", "data": task_view})
    logger.warning("Task %s not delivered: node %s offline", task_id, node_id)
    return False


async def dispatch_tasks(task_ids: list[str]) -> None:
    for task_id in task_ids:
        await dispatch_task(task_id)
