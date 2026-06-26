"""Pydantic schemas for nodes (API responses + WS register payload)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.enums import IntegrityStatus, NodeStatus, NodeType, TaskStatus
from app.core.policies import NODE_POLICIES


class NodeRegister(BaseModel):
    """Payload a node sends in its `register` message."""

    node_id: str = Field(min_length=1, max_length=128)
    hostname: str = Field(default="", max_length=255)
    os: str = Field(default="", max_length=128)
    username: str = Field(default="", max_length=128)
    token: str | None = Field(default=None, max_length=512)
    public_key: str | None = Field(default=None, max_length=128)
    node_type: str | None = Field(default=None, max_length=32)
    iot_snapshot: dict | None = None
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
    alias: str = ""
    tags: list[str] = Field(default_factory=list)
    group: str = ""
    description: str = ""
    enabled: bool = True
    trusted: bool = True
    node_type: NodeType = NodeType.REAL
    policy_id: str = "basic_safe"
    public_key: str = ""
    fingerprint: str = ""
    iot_snapshot: dict | None = None
    iot_devices: list[dict] | None = None

    model_config = {"from_attributes": True}


class NodeUpdate(BaseModel):
    alias: str | None = Field(default=None, max_length=128)
    tags: list[str] | None = None
    group: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=512)
    enabled: bool | None = None
    trusted: bool | None = None
    node_type: NodeType | None = None
    policy_id: str | None = Field(default=None, max_length=64)

    @field_validator("policy_id")
    @classmethod
    def policy_must_exist(cls, value: str | None) -> str | None:
        if value is not None and value not in NODE_POLICIES:
            raise ValueError(f"unknown policy_id '{value}'")
        return value


class NodeHealthFactor(BaseModel):
    label: str
    score: int
    detail: str


class NodeHealthExplanation(BaseModel):
    total_score: int
    factors: list[NodeHealthFactor]


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
    health: NodeHealthExplanation
    tasks: list[NodeTaskHistoryRow]


class PolicyRead(BaseModel):
    id: str
    name: str
    description: str
    plugins: list[str]
