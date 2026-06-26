"""Agent ORM model."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel

from app.core.enums import AgentStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Agent(SQLModel, table=True):
    __tablename__ = "agents"

    id: str = Field(primary_key=True, description="Stable agent_id")
    hostname: str = ""
    os: str = ""
    username: str = ""
    status: AgentStatus = Field(default=AgentStatus.OFFLINE)
    health_score: int = Field(default=100, ge=0, le=100)
    first_seen: datetime = Field(default_factory=_utcnow)
    last_seen: datetime = Field(default_factory=_utcnow)
    registered_at: datetime = Field(default_factory=_utcnow)
