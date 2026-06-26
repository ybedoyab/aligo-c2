"""In-memory WebSocket connection manager for nodes and operators."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("aligo.ws")


class ConnectionManager:
    """Tracks live node sockets and operator (dashboard) sockets."""

    def __init__(self) -> None:
        self._nodes: dict[str, WebSocket] = {}
        self._operators: set[WebSocket] = set()

    # -- Nodes ---------------------------------------------------------------
    def register_node(self, node_id: str, websocket: WebSocket) -> None:
        self._nodes[node_id] = websocket
        logger.info("Node connected: %s (total=%d)", node_id, len(self._nodes))

    def remove_node(self, node_id: str) -> None:
        self._nodes.pop(node_id, None)
        logger.info("Node disconnected: %s (total=%d)", node_id, len(self._nodes))

    def is_node_connected(self, node_id: str) -> bool:
        return node_id in self._nodes

    def connected_node_ids(self) -> list[str]:
        return list(self._nodes.keys())

    async def send_to_node(self, node_id: str, message: dict[str, Any]) -> bool:
        """Send a JSON message to a specific node. Returns False if not connected."""
        ws = self._nodes.get(node_id)
        if ws is None:
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception as exc:  # pragma: no cover - transport dependent
            logger.warning("Failed sending to node %s: %s", node_id, exc)
            self.remove_node(node_id)
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
