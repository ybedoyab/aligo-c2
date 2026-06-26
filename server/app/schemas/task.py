"""Pydantic schemas for tasks and evidence."""

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
    policy_decision: dict[str, Any] | None = None
    evidence_hash: str | None = None
    merkle_proof: list[str] | None = None
    created_at: datetime
    sent_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class PolicyDecisionRead(BaseModel):
    decision: str
    policy_id: str | None = None
    node_id: str
    plugin: str
    reason: str
    evaluated_rules: list[dict[str, Any]]
    timestamp: str


class CustodyStepRead(BaseModel):
    step: int
    label: str
    timestamp: str | None = None
    status: str
    detail: str = ""


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
    block_number: int | None = None
    on_chain_status: OnChainStatus | None = None
    integrity_status: IntegrityStatus = IntegrityStatus.UNKNOWN
    result_id: str | None = None
    # Node identity & signature
    node_fingerprint: str | None = None
    node_public_key: str | None = None
    node_signature: str | None = None
    signature_status: str | None = None
    # Policy
    policy_decision: dict[str, Any] | None = None
    # Merkle
    evidence_hash: str | None = None
    mission_merkle_root: str | None = None
    merkle_proof: list[str] | None = None
    merkle_proof_status: str | None = None
    # Chain of custody
    chain_of_custody: list[CustodyStepRead] = Field(default_factory=list)
    anchored_snapshot: dict[str, Any] | None = None
    # IoT evidence
    node_type: str | None = None
    device_id: str | None = None
    device_type: str | None = None
    evidence_class: str | None = None
    iot_summary: dict[str, Any] | None = None


class EvidenceBundleRead(TaskEvidenceRead):
    """Full export bundle for independent verification."""

    verification_summary: dict[str, Any] = Field(default_factory=dict)
    ledger_payload: dict[str, Any] | None = None
    result_timestamp: str | None = None
    signed_payload: dict[str, Any] | None = None


class DryRunTaskItem(BaseModel):
    node_id: str
    plugin: str
    decision: str
    reason: str
    ready: bool


class MissionDryRunRead(BaseModel):
    mission_id: str
    ready: bool
    tasks_to_dispatch: int
    blocked_count: int
    ledger_connected: bool
    items: list[DryRunTaskItem]
    summary: str
