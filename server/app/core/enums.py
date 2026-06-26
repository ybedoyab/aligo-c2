"""Shared string enums and constants used across models, schemas and services."""

from __future__ import annotations

from enum import StrEnum


class NodeStatus(StrEnum):
    ONLINE = "online"
    OFFLINE = "offline"
    WARNING = "warning"
    ERROR = "error"


class MissionStatus(StrEnum):
    DRAFT = "draft"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIALLY_FAILED = "partially_failed"


class TaskStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


class EventType(StrEnum):
    NODE_REGISTERED = "NODE_REGISTERED"
    MISSION_CREATED = "MISSION_CREATED"
    MISSION_STARTED = "MISSION_STARTED"
    TASK_SENT = "TASK_SENT"
    TASK_RESULT = "TASK_RESULT"
    TASK_FAILED = "TASK_FAILED"
    MISSION_COMPLETED = "MISSION_COMPLETED"
    NODE_DISCONNECTED = "NODE_DISCONNECTED"
    NODE_RECONNECTED = "NODE_RECONNECTED"


class OnChainStatus(StrEnum):
    DISABLED = "disabled"
    PENDING_CHAIN = "pending_chain"
    CONFIRMED = "confirmed"   # legacy alias; treat same as anchored
    ANCHORED = "anchored"     # successfully written on-chain


class ChainStatus(StrEnum):
    """High-level blockchain connectivity for the operator UI."""
    CONNECTED = "connected"
    CONTRACT_NOT_CONFIGURED = "contract_not_configured"
    DISCONNECTED = "disconnected"
    LOCAL_ONLY = "local_only"


class IntegrityStatus(StrEnum):
    VERIFIED = "verified"
    PENDING_CHAIN = "pending_chain"
    TAMPERED = "tampered"
    LOCAL_ONLY = "local_only"
    UNKNOWN = "unknown"


# Allowlisted plugins the operator may target. Mirrors the node plugin registry.
ALLOWED_PLUGINS: frozenset[str] = frozenset(
    {
        "system_info",
        "health_check",
        "echo",
        "list_lab_directory",
        "network_info",
        "allowed_command",
    }
)
