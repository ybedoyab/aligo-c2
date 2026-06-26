"""health_check plugin: report agent uptime, timestamp, latency and status."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

# Captured when the module is first imported (i.e. agent process start).
_START_MONOTONIC = time.monotonic()


def run(args: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    uptime_seconds = round(time.monotonic() - _START_MONOTONIC, 3)
    # A trivial self-measurement used as an estimated processing latency sample.
    latency_ms = round((time.perf_counter() - start) * 1000, 3)
    return {
        "status": "healthy",
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latency_ms": latency_ms,
    }
