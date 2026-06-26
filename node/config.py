"""Node configuration sourced from environment variables with sane lab defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class NodeConfig:
    ws_url: str
    shared_token: str
    heartbeat_interval: float
    reconnect_base_delay: float
    reconnect_max_delay: float
    task_timeout: float
    max_message_bytes: int

    @classmethod
    def from_env(cls) -> "NodeConfig":
        return cls(
            ws_url=os.getenv("C2_WS_URL", "ws://localhost:8000/ws/node"),
            shared_token=os.getenv("NODE_SHARED_TOKEN", "change-me-lab-token"),
            heartbeat_interval=float(os.getenv("NODE_HEARTBEAT_INTERVAL", "5")),
            reconnect_base_delay=float(os.getenv("NODE_RECONNECT_BASE_DELAY", "1")),
            reconnect_max_delay=float(os.getenv("NODE_RECONNECT_MAX_DELAY", "30")),
            task_timeout=float(os.getenv("NODE_TASK_TIMEOUT", "30")),
            max_message_bytes=int(os.getenv("NODE_MAX_MESSAGE_BYTES", str(256 * 1024))),
        )
