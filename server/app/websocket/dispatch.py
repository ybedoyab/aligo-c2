"""Dispatch tasks to connected agents over WebSocket and record ledger events."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlmodel import Session

from app.core.enums import EventType, TaskStatus
from app.db.database import engine
from app.schemas.task import TaskRead
from app.services import task_service
from app.websocket import notifier
from app.websocket.manager import manager

logger = logging.getLogger("aligo.dispatch")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


async def dispatch_task(task_id: str) -> bool:
    """Send a single task to its agent. Marks it failed if the agent is offline."""
    with Session(engine) as session:
        task = task_service.get_task(session, task_id)
        if task is None:
            return False
        task_view = TaskRead.model_validate(task).model_dump(mode="json")

    agent_id = task_view["agent_id"]
    message = {
        "type": "task",
        "task_id": task_view["id"],
        "mission_id": task_view["mission_id"],
        "plugin": task_view["plugin"],
        "args": task_view["args"],
        "timestamp": _now_iso(),
    }

    delivered = await manager.send_to_agent(agent_id, message)

    if delivered:
        with Session(engine) as session:
            task = task_service.mark_sent(session, task_id)
            task_view = TaskRead.model_validate(task).model_dump(mode="json")
        await notifier.emit_event(
            event_type=EventType.TASK_SENT,
            mission_id=task_view["mission_id"],
            task_id=task_view["id"],
            agent_id=agent_id,
            data={"plugin": task_view["plugin"], "args": task_view["args"]},
        )
        await notifier.broadcast({"type": "task_update", "data": task_view})
        return True

    # Agent not connected: mark the task failed so missions don't hang forever.
    with Session(engine) as session:
        task = task_service.set_status(session, task_id, TaskStatus.FAILED)
        task_view = TaskRead.model_validate(task).model_dump(mode="json")
    await notifier.emit_event(
        event_type=EventType.TASK_FAILED,
        mission_id=task_view["mission_id"],
        task_id=task_view["id"],
        agent_id=agent_id,
        data={"reason": "agent not connected"},
    )
    await notifier.broadcast({"type": "task_update", "data": task_view})
    logger.warning("Task %s not delivered: agent %s offline", task_id, agent_id)
    return False


async def dispatch_tasks(task_ids: list[str]) -> None:
    for task_id in task_ids:
        await dispatch_task(task_id)
