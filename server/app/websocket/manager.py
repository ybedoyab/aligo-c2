"""In-memory WebSocket connection manager for agents and operators."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("aligo.ws")


class ConnectionManager:
    """Tracks live agent sockets and operator (dashboard) sockets."""

    def __init__(self) -> None:
        self._agents: dict[str, WebSocket] = {}
        self._operators: set[WebSocket] = set()

    # -- Agents ---------------------------------------------------------------
    def register_agent(self, agent_id: str, websocket: WebSocket) -> None:
        self._agents[agent_id] = websocket
        logger.info("Agent connected: %s (total=%d)", agent_id, len(self._agents))

    def remove_agent(self, agent_id: str) -> None:
        self._agents.pop(agent_id, None)
        logger.info("Agent disconnected: %s (total=%d)", agent_id, len(self._agents))

    def is_agent_connected(self, agent_id: str) -> bool:
        return agent_id in self._agents

    def connected_agent_ids(self) -> list[str]:
        return list(self._agents.keys())

    async def send_to_agent(self, agent_id: str, message: dict[str, Any]) -> bool:
        """Send a JSON message to a specific agent. Returns False if not connected."""
        ws = self._agents.get(agent_id)
        if ws is None:
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception as exc:  # pragma: no cover - transport dependent
            logger.warning("Failed sending to agent %s: %s", agent_id, exc)
            self.remove_agent(agent_id)
            return False

    # -- Operators ------------------------------------------------------------
    async def connect_operator(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._operators.add(websocket)
        logger.info("Operator connected (total=%d)", len(self._operators))

    def remove_operator(self, websocket: WebSocket) -> None:
        self._operators.discard(websocket)
        logger.info("Operator disconnected (total=%d)", len(self._operators))

    async def broadcast_operators(self, message: dict[str, Any]) -> None:
        """Push a JSON message to every connected operator dashboard."""
        stale: list[WebSocket] = []
        for ws in list(self._operators):
            try:
                await ws.send_json(message)
            except Exception:  # pragma: no cover - transport dependent
                stale.append(ws)
        for ws in stale:
            self.remove_operator(ws)


# Process-wide singleton.
manager = ConnectionManager()
