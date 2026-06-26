"""Pydantic schemas for tasks."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.enums import ALLOWED_PLUGINS, IntegrityStatus, OnChainStatus, TaskStatus


class TaskCreate(BaseModel):
    """Create a single ad-hoc task (e.g. the 'quick task' button)."""

    node_id: str = Field(min_length=1)
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
    node_id: str
    plugin: str
    args: dict[str, Any]
    status: TaskStatus
    created_at: datetime
    sent_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class TaskEvidenceRead(BaseModel):
    task_id: str
    node_id: str
    mission_id: str
    mission_name: str | None = None
    plugin: str
    args: dict[str, Any]
    status: TaskStatus
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    duration_ms: int | None = None
    created_at: datetime
    sent_at: datetime | None = None
    completed_at: datetime | None = None
    local_hash: str | None = None
    previous_hash: str | None = None
    ledger_event_id: str | None = None
    blockchain_tx_hash: str | None = None
    on_chain_status: OnChainStatus | None = None
    integrity_status: IntegrityStatus = IntegrityStatus.UNKNOWN
    result_id: str | None = None
