"""Background subscriber to the C2 `/ws/operator` event stream.

The socket is read-only (the server accepts no commands over it). We keep an
in-memory snapshot of the latest node/task/mission/result/ledger envelopes so the
agent can reason over live state without hammering REST. If the C2 is down the
listener simply keeps retrying — it never crashes the agent process.

Envelope shape (from server/app/websocket): {"type": "...", "data": {...}}.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections import deque
from typing import Any

import websockets

from app.config import settings

logger = logging.getLogger("agent.ws")


class LiveState:
    """Latest-known C2 state, fed by the operator WebSocket."""

    def __init__(self, max_events: int = 100) -> None:
        self.connected: bool = False
        self.nodes: dict[str, dict[str, Any]] = {}
        self.tasks: dict[str, dict[str, Any]] = {}
        self.missions: dict[str, dict[str, Any]] = {}
        self.recent_events: deque[dict[str, Any]] = deque(maxlen=max_events)

    def apply(self, envelope: dict[str, Any]) -> None:
        etype = envelope.get("type")
        data = envelope.get("data") or {}
        if etype == "connected":
            return
        self.recent_events.append({"type": etype, "data": data})
        if etype == "node_update" and data.get("id"):
            self.nodes[data["id"]] = data
        elif etype == "task_update" and data.get("id"):
            self.tasks[data["id"]] = data
        elif etype == "mission_update" and data.get("id"):
            self.missions[data["id"]] = data

    def snapshot(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "node_count": len(self.nodes),
            "online_nodes": [
                n.get("id") for n in self.nodes.values() if n.get("status") == "online"
            ],
            "recent_events": list(self.recent_events)[-20:],
        }


live_state = LiveState()


class WsListener:
    """Owns the reconnecting WebSocket task."""

    def __init__(self, url: str | None = None) -> None:
        self._url = url or settings.c2_ws_url
        self._task: asyncio.Task[None] | None = None
        self._stopped = asyncio.Event()

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._stopped.clear()
            self._task = asyncio.create_task(self._run(), name="ws-listener")

    async def stop(self) -> None:
        self._stopped.set()
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def _run(self) -> None:
        backoff = 1.0
        while not self._stopped.is_set():
            try:
                async with websockets.connect(self._url, ping_interval=20) as ws:
                    live_state.connected = True
                    backoff = 1.0
                    logger.info("operator WS connected: %s", self._url)
                    async for raw in ws:
                        try:
                            live_state.apply(json.loads(raw))
                        except (json.JSONDecodeError, TypeError):
                            logger.debug("dropping malformed WS frame")
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - resilience over precision
                logger.warning("operator WS disconnected (%s); retrying in %.0fs", exc, backoff)
            finally:
                live_state.connected = False
            if self._stopped.is_set():
                break
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)


listener = WsListener()
