"""WebSocket endpoint for operator dashboards (/ws/operator).

Operators receive a live stream of node/task/result/mission/ledger updates. The channel
is read-mostly; clients may send a lightweight 'ping' to keep the connection warm.
"""

from __future__ import annotations

import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.websocket.manager import manager

logger = logging.getLogger("aligo.ws.operator")


async def operator_endpoint(websocket: WebSocket) -> None:
    await manager.connect_operator(websocket)
    try:
        await websocket.send_json({"type": "connected", "data": {"channel": "operator"}})
        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > settings.max_ws_message_bytes:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.info("Operator disconnected")
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Operator socket error: %s", exc)
    finally:
        manager.remove_operator(websocket)
