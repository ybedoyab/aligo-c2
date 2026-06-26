"""Pydantic schemas for agents (API responses + WS register payload)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import AgentStatus


class AgentRegister(BaseModel):
    """Payload an agent sends in its `register` message."""

    agent_id: str = Field(min_length=1, max_length=128)
    hostname: str = Field(default="", max_length=255)
    os: str = Field(default="", max_length=128)
    username: str = Field(default="", max_length=128)
    token: str | None = Field(default=None, max_length=512)
    timestamp: str | None = None


class AgentRead(BaseModel):
    id: str
    hostname: str
    os: str
    username: str
    status: AgentStatus
    health_score: int
    first_seen: datetime
    last_seen: datetime
    registered_at: datetime

    model_config = {"from_attributes": True}
