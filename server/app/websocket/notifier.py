"""Async helpers that record ledger events and push live updates to operators.

Ledger recording performs blocking DB + (optionally) blocking web3 calls, so it always
runs in a threadpool with its own DB session to avoid blocking the event loop.
"""

from __future__ import annotations

from typing import Any

from starlette.concurrency import run_in_threadpool
from sqlmodel import Session

from app.core.enums import EventType
from app.db.database import engine
from app.schemas.ledger import LedgerEventRead
from app.services import ledger_service
from app.websocket.manager import manager


async def emit_event(
    *,
    event_type: EventType,
    mission_id: str = "",
    task_id: str = "",
    agent_id: str = "",
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Record a ledger event (off-chain + best-effort on-chain) and broadcast it."""

    def _work() -> dict[str, Any]:
        with Session(engine) as session:
            event = ledger_service.record_event(
                session,
                event_type=event_type,
                mission_id=mission_id,
                task_id=task_id,
                agent_id=agent_id,
                data=data or {},
            )
            return LedgerEventRead.model_validate(event).model_dump(mode="json")

    payload = await run_in_threadpool(_work)
    await manager.broadcast_operators({"type": "ledger_event", "data": payload})
    return payload


async def broadcast(message: dict[str, Any]) -> None:
    """Send an arbitrary message to all operator dashboards."""
    await manager.broadcast_operators(message)
