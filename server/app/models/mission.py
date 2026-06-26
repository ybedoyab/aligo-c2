"""Mission ORM model.

A mission is a reusable template: a name plus an ordered list of steps, where each
step is {"plugin": str, "args": dict}. When started, tasks are generated as the cross
product of steps and the selected target nodes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.core.enums import MissionStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Mission(SQLModel, table=True):
    __tablename__ = "missions"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    status: MissionStatus = Field(default=MissionStatus.DRAFT)
    steps: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    target_node_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    is_predefined: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_utcnow)
    started_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)
