"""Shared string enums and constants used across models, schemas and services."""

from __future__ import annotations

from enum import StrEnum


class NodeStatus(StrEnum):
    ONLINE = "online"
    OFFLINE = "offline"
    WARNING = "warning"
    ERROR = "error"


class NodeType(StrEnum):
    REAL = "real"
    SIMULATED = "simulated"
    COMPUTER_NODE = "computer_node"
    IOT_GATEWAY = "iot_gateway"
    IOT_SENSOR = "iot_sensor"
    IOT_ACTUATOR = "iot_actuator"
    AI_ANALYST = "ai_analyst"


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
    BLOCKED_BY_POLICY = "blocked_by_policy"


class EventType(StrEnum):
    NODE_REGISTERED = "NODE_REGISTERED"
    MISSION_CREATED = "MISSION_CREATED"
    MISSION_STARTED = "MISSION_STARTED"
    TASK_SENT = "TASK_SENT"
    TASK_RESULT = "TASK_RESULT"
    TASK_FAILED = "TASK_FAILED"
    MISSION_COMPLETED = "MISSION_COMPLETED"
    MISSION_MERKLE_ROOT = "MISSION_MERKLE_ROOT"
    NODE_DISCONNECTED = "NODE_DISCONNECTED"
    NODE_RECONNECTED = "NODE_RECONNECTED"
    PLUGIN_BLOCKED = "PLUGIN_BLOCKED"
    POLICY_BLOCKED = "POLICY_BLOCKED"


class SignatureStatus(StrEnum):
    VALID = "valid"
    INVALID = "invalid"
    MISSING = "missing"


class PolicyDecision(StrEnum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"


class MerkleProofStatus(StrEnum):
    VALID = "valid"
    INVALID = "invalid"
    PENDING = "pending"
    NOT_APPLICABLE = "not_applicable"


class VerifierStatus(StrEnum):
    VERIFIED = "VERIFIED"
    TAMPERED = "TAMPERED"
    SIGNATURE_INVALID = "SIGNATURE_INVALID"
    NOT_ANCHORED = "NOT_ANCHORED"
    MERKLE_INVALID = "MERKLE_INVALID"
    INCOMPLETE = "INCOMPLETE"


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
from app.core.iot_plugins import IOT_PLUGINS

_COMPUTER_PLUGINS = frozenset(
    {
        "system_info",
        "health_check",
        "echo",
        "list_lab_directory",
        "network_info",
        "allowed_command",
    }
)

ALLOWED_PLUGINS: frozenset[str] = _COMPUTER_PLUGINS | IOT_PLUGINS
