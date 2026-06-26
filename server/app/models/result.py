"""Result ORM model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.core.enums import TaskStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Result(SQLModel, table=True):
    __tablename__ = "results"

    id: str = Field(primary_key=True)
    task_id: str = Field(foreign_key="tasks.id", index=True)
    mission_id: str = Field(index=True)
    node_id: str = Field(index=True)
    status: TaskStatus
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    duration_ms: int = 0
    result_metadata: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column("metadata", JSON)
    )
    node_signature: str = Field(default="", max_length=256)
    signature_status: str = Field(default="missing", max_length=16)
    created_at: datetime = Field(default_factory=_utcnow)
