"""Pydantic schemas for IoT lab API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.enums import ALLOWED_PLUGINS


class IoTActionRequest(BaseModel):
    plugin: str
    args: dict[str, Any] = Field(default_factory=dict)
    gateway_id: str = "gateway-sim-001"

    @field_validator("plugin")
    @classmethod
    def plugin_must_be_allowed(cls, value: str) -> str:
        if value not in ALLOWED_PLUGINS:
            raise ValueError(f"plugin '{value}' is not allowed")
        return value


class IoTLabRead(BaseModel):
    gateway_id: str
    online: bool
    status: str
    health_score: int
    policy_id: str
    last_seen: str | None
    node_type: str
    subdevice_count: int
    devices: list[dict[str, Any]]
    snapshot: dict[str, Any]
    telemetry: dict[str, Any]
    recent_events: list[dict[str, Any]]
    stats: dict[str, Any]
