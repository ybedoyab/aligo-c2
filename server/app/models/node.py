"""Node ORM model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.core.enums import NodeStatus, NodeType
from app.core.policies import DEFAULT_POLICY_ID


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Node(SQLModel, table=True):
    __tablename__ = "nodes"

    id: str = Field(primary_key=True, description="Stable node_id")
    hostname: str = ""
    os: str = ""
    username: str = ""
    status: NodeStatus = Field(default=NodeStatus.OFFLINE)
    health_score: int = Field(default=100, ge=0, le=100)
    first_seen: datetime = Field(default_factory=_utcnow)
    last_seen: datetime = Field(default_factory=_utcnow)
    registered_at: datetime = Field(default_factory=_utcnow)

    # Operator-managed registry metadata (CRUD)
    alias: str = Field(default="", max_length=128)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    group: str = Field(default="", max_length=64)
    description: str = Field(default="", max_length=512)
    enabled: bool = Field(default=True)
    trusted: bool = Field(default=True)
    node_type: NodeType = Field(default=NodeType.REAL)
    policy_id: str = Field(default=DEFAULT_POLICY_ID, max_length=64)
