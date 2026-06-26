"""Task ORM model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.core.enums import TaskStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(primary_key=True)
    mission_id: str = Field(foreign_key="missions.id", index=True)
    agent_id: str = Field(foreign_key="agents.id", index=True)
    plugin: str
    args: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    created_at: datetime = Field(default_factory=_utcnow)
    sent_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)
