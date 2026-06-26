"""Pydantic schemas for results."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.core.enums import TaskStatus


class ResultIn(BaseModel):
    """Result payload sent by an node over the WebSocket."""

    task_id: str
    mission_id: str = ""
    node_id: str
    status: TaskStatus
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    duration_ms: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    node_signature: str = ""
    timestamp: str | None = None


class ResultRead(BaseModel):
    id: str
    task_id: str
    mission_id: str
    node_id: str
    status: TaskStatus
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int
    result_metadata: dict[str, Any]
    node_signature: str = ""
    signature_status: str = "missing"
    created_at: datetime

    model_config = {"from_attributes": True}
