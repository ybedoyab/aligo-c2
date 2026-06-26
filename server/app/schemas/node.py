"""Pydantic schemas for nodes (API responses + WS register payload)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import NodeStatus, IntegrityStatus, TaskStatus


class NodeRegister(BaseModel):
    """Payload an node sends in its `register` message."""

    node_id: str = Field(min_length=1, max_length=128)
    hostname: str = Field(default="", max_length=255)
    os: str = Field(default="", max_length=128)
    username: str = Field(default="", max_length=128)
    token: str | None = Field(default=None, max_length=512)
    timestamp: str | None = None


class NodeRead(BaseModel):
    id: str
    hostname: str
    os: str
    username: str
    status: NodeStatus
    health_score: int
    first_seen: datetime
    last_seen: datetime
    registered_at: datetime

    model_config = {"from_attributes": True}


class NodeStats(BaseModel):
    total_tasks: int = 0
    successful_tasks: int = 0
    failed_tasks: int = 0


class NodeTaskHistoryRow(BaseModel):
    task_id: str
    mission_id: str
    plugin: str
    args: dict
    status: TaskStatus
    duration_ms: int | None = None
    exit_code: int | None = None
    created_at: datetime
    completed_at: datetime | None
    ledger_event_id: str | None = None
    integrity_status: IntegrityStatus = IntegrityStatus.UNKNOWN


class NodeDetailRead(BaseModel):
    node: NodeRead
    stats: NodeStats
    last_heartbeat: datetime
    tasks: list[NodeTaskHistoryRow]
