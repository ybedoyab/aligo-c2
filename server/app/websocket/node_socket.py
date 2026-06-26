"""WebSocket endpoint handling node connections (/ws/node)."""

from __future__ import annotations

import json
import logging

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlmodel import Session

from app.core.config import settings
from app.core.enums import EventType, TaskStatus
from app.core.security import verify_node_token
from app.db.database import engine
from app.schemas.node import NodeRead, NodeRegister
from app.schemas.result import ResultIn
from app.services import node_service, mission_service, result_service
from app.websocket import notifier
from app.websocket.manager import manager

logger = logging.getLogger("aligo.ws.node")


async def _reject(websocket: WebSocket, reason: str, code: int = 1008) -> None:
    try:
        await websocket.send_json({"type": "error", "error": reason})
    except Exception:
        pass
    await websocket.close(code=code)


async def node_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    node_id: str | None = None
    try:
        # ---- Registration handshake ----
        raw = await websocket.receive_text()
        if len(raw.encode("utf-8")) > settings.max_ws_message_bytes:
            await _reject(websocket, "register message too large")
            return
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await _reject(websocket, "invalid JSON in register")
            return

        if msg.get("type") != "register":
            await _reject(websocket, "first message must be 'register'")
            return

        try:
            reg = NodeRegister(**msg)
        except ValidationError as exc:
            await _reject(websocket, f"invalid register payload: {exc.errors()}")
            return

        if not verify_node_token(reg.token):
            await _reject(websocket, "invalid node token")
            return

        with Session(engine) as session:
            node, is_new = node_service.register_node(session, reg)
            node_payload = NodeRead.model_validate(node).model_dump(mode="json")
        node_id = reg.node_id
        manager.register_node(node_id, websocket)

        await websocket.send_json(
            {
                "type": "register_ack",
                "node_id": node_id,
                "server_time": node_payload["last_seen"],
            }
        )

        event_type = (
            EventType.NODE_REGISTERED if is_new else EventType.NODE_RECONNECTED
        )
        await notifier.emit_event(
            event_type=event_type,
            node_id=node_id,
            data={
                "hostname": reg.hostname,
                "os": reg.os,
                "username": reg.username,
            },
        )
        await notifier.broadcast({"type": "node_update", "data": node_payload})

        # ---- Message loop ----
        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > settings.max_ws_message_bytes:
                await websocket.send_json(
                    {"type": "error", "error": "message exceeds size limit"}
                )
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "error": "invalid JSON"})
                continue

            await _handle_node_message(websocket, node_id, msg)

    except WebSocketDisconnect:
        logger.info("Node socket disconnected: %s", node_id)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Node socket error (%s): %s", node_id, exc)
    finally:
        if node_id:
            manager.remove_node(node_id)
            with Session(engine) as session:
                node = node_service.mark_disconnected(session, node_id)
                node_payload = (
                    NodeRead.model_validate(node).model_dump(mode="json")
                    if node
                    else None
                )
            await notifier.emit_event(
                event_type=EventType.NODE_DISCONNECTED, node_id=node_id
            )
            if node_payload:
                await notifier.broadcast(
                    {"type": "node_update", "data": node_payload}
                )


async def _handle_node_message(
    websocket: WebSocket, node_id: str, msg: dict
) -> None:
    msg_type = msg.get("type")

    if msg_type == "heartbeat":
        with Session(engine) as session:
            node = node_service.heartbeat(session, node_id)
            payload = (
                NodeRead.model_validate(node).model_dump(mode="json")
                if node
                else None
            )
        if payload:
            await notifier.broadcast({"type": "node_update", "data": payload})
        return

    if msg_type == "task_ack":
        # Informational; the task was already marked 'sent' when dispatched.
        return

    if msg_type == "result":
        await _handle_result(msg)
        return

    if msg_type == "error":
        logger.warning("Node %s reported error: %s", node_id, msg.get("error"))
        return

    await websocket.send_json(
        {"type": "error", "error": f"unknown message type: {msg_type}"}
    )


async def _handle_result(msg: dict) -> None:
    try:
        payload = ResultIn(**msg)
    except ValidationError as exc:
        logger.warning("Invalid result payload: %s", exc.errors())
        return

    from app.schemas.result import ResultRead
    from app.schemas.task import TaskRead

    with Session(engine) as session:
        result = result_service.save_result(session, payload)
        result_payload = ResultRead.model_validate(result).model_dump(mode="json")
        from app.services import task_service

        task = task_service.get_task(session, payload.task_id)
        task_payload = (
            TaskRead.model_validate(task).model_dump(mode="json") if task else None
        )

    # Ledger event: success vs failure.
    event_type = (
        EventType.TASK_RESULT
        if payload.status == TaskStatus.SUCCESS
        else EventType.TASK_FAILED
    )
    await notifier.emit_event(
        event_type=event_type,
        mission_id=payload.mission_id,
        task_id=payload.task_id,
        node_id=payload.node_id,
        data={
            "status": str(payload.status),
            "exit_code": payload.exit_code,
            "duration_ms": payload.duration_ms,
            "stdout": payload.stdout,
            "stderr": payload.stderr,
            "metadata": payload.metadata,
        },
    )

    await notifier.broadcast({"type": "result", "data": result_payload})
    if task_payload:
        await notifier.broadcast({"type": "task_update", "data": task_payload})

    # Recompute mission status and emit MISSION_COMPLETED if it just finished.
    if payload.mission_id:
        from app.schemas.mission import MissionRead

        with Session(engine) as session:
            mission = mission_service.recompute_status(session, payload.mission_id)
            mission_payload = (
                MissionRead.model_validate(mission).model_dump(mode="json")
                if mission
                else None
            )
        if mission_payload:
            await notifier.emit_event(
                event_type=EventType.MISSION_COMPLETED,
                mission_id=payload.mission_id,
                data={"status": mission_payload["status"]},
            )
            await notifier.broadcast(
                {"type": "mission_update", "data": mission_payload}
            )
