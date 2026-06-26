"""Protocol message builders shared by the node.

Mirrors docs/protocol.md. Message types:
register, register_ack, heartbeat, task, task_ack, result, error,
mission_start, mission_complete.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

PROTOCOL_VERSION = "1.0"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def register_message(
    node_id: str, hostname: str, os_name: str, username: str, token: str
) -> dict[str, Any]:
    return {
        "type": "register",
        "protocol": PROTOCOL_VERSION,
        "node_id": node_id,
        "hostname": hostname,
        "os": os_name,
        "username": username,
        "token": token,
        "timestamp": now_iso(),
    }


def heartbeat_message(node_id: str) -> dict[str, Any]:
    return {"type": "heartbeat", "node_id": node_id, "timestamp": now_iso()}


def task_ack_message(task_id: str, node_id: str) -> dict[str, Any]:
    return {
        "type": "task_ack",
        "task_id": task_id,
        "node_id": node_id,
        "timestamp": now_iso(),
    }


def result_message(
    *,
    task_id: str,
    mission_id: str,
    node_id: str,
    status: str,
    stdout: str,
    stderr: str,
    exit_code: int,
    duration_ms: int,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "type": "result",
        "task_id": task_id,
        "mission_id": mission_id,
        "node_id": node_id,
        "status": status,
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
        "duration_ms": duration_ms,
        "metadata": metadata or {},
        "timestamp": now_iso(),
    }


def error_message(node_id: str, error: str) -> dict[str, Any]:
    return {
        "type": "error",
        "node_id": node_id,
        "error": error,
        "timestamp": now_iso(),
    }
