"""LedgerEvent ORM model - the off-chain record of each Proof-of-Execution event."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.core.enums import EventType, OnChainStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LedgerEvent(SQLModel, table=True):
    __tablename__ = "ledger_events"

    id: str = Field(primary_key=True, description="event_id")
    sequence: int | None = Field(default=None, index=True)
    mission_id: str = Field(default="", index=True)
    task_id: str = Field(default="", index=True)
    agent_id: str = Field(default="", index=True)
    event_type: EventType
    # The exact payload that was hashed (canonical JSON of this dict reproduces the hash).
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    payload_hash: str = Field(index=True)
    previous_hash: str = ""
    timestamp: str = ""  # ISO-8601 string captured at event creation

    # On-chain anchoring metadata
    onchain_status: OnChainStatus = Field(default=OnChainStatus.PENDING_CHAIN)
    tx_hash: str | None = Field(default=None)
    block_number: int | None = Field(default=None)

    created_at: datetime = Field(default_factory=_utcnow)
