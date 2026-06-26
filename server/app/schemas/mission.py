"""Pydantic schemas for missions."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.enums import ALLOWED_PLUGINS, MissionStatus


class MissionStep(BaseModel):
    plugin: str
    args: dict[str, Any] = Field(default_factory=dict)

    @field_validator("plugin")
    @classmethod
    def plugin_must_be_allowed(cls, value: str) -> str:
        if value not in ALLOWED_PLUGINS:
            raise ValueError(
                f"plugin '{value}' is not in the allowlist {sorted(ALLOWED_PLUGINS)}"
            )
        return value


class MissionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    steps: list[MissionStep] = Field(min_length=1)
    target_agent_ids: list[str] = Field(default_factory=list)


class MissionStart(BaseModel):
    """Optionally override which agents the mission runs on."""

    target_agent_ids: list[str] | None = None


class MissionRead(BaseModel):
    id: str
    name: str
    description: str
    status: MissionStatus
    steps: list[dict[str, Any]]
    target_agent_ids: list[str]
    is_predefined: bool
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}
