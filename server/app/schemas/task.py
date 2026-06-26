"""Pydantic schemas for tasks."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.enums import ALLOWED_PLUGINS, TaskStatus


class TaskCreate(BaseModel):
    """Create a single ad-hoc task (e.g. the 'quick task' button)."""

    agent_id: str = Field(min_length=1)
    plugin: str
    args: dict[str, Any] = Field(default_factory=dict)
    mission_id: str | None = None

    @field_validator("plugin")
    @classmethod
    def plugin_must_be_allowed(cls, value: str) -> str:
        if value not in ALLOWED_PLUGINS:
            raise ValueError(
                f"plugin '{value}' is not in the allowlist {sorted(ALLOWED_PLUGINS)}"
            )
        return value


class TaskRead(BaseModel):
    id: str
    mission_id: str
    agent_id: str
    plugin: str
    args: dict[str, Any]
    status: TaskStatus
    created_at: datetime
    sent_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}
