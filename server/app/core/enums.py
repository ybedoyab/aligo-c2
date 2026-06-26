"""Shared string enums and constants used across models, schemas and services."""

from __future__ import annotations

from enum import StrEnum


class AgentStatus(StrEnum):
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
    AGENT_REGISTERED = "AGENT_REGISTERED"
    MISSION_CREATED = "MISSION_CREATED"
    MISSION_STARTED = "MISSION_STARTED"
    TASK_SENT = "TASK_SENT"
    TASK_RESULT = "TASK_RESULT"
    TASK_FAILED = "TASK_FAILED"
    MISSION_COMPLETED = "MISSION_COMPLETED"
    AGENT_DISCONNECTED = "AGENT_DISCONNECTED"
    AGENT_RECONNECTED = "AGENT_RECONNECTED"


class OnChainStatus(StrEnum):
    DISABLED = "disabled"          # ledger turned off
    PENDING_CHAIN = "pending_chain"  # stored locally, not yet/never anchored
    CONFIRMED = "confirmed"        # anchored on-chain


# Allowlisted plugins the operator may target. Mirrors the agent plugin registry.
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
