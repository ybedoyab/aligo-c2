"""Simulated IoT gateway node — connects to C2 like a computer node but routes IoT plugins."""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
import logging
import platform
import socket
import time
from typing import Any

import websockets

from config import NodeConfig
from identity import load_or_create_identity
from iot_sim.devices import STORE
from iot_sim.plugins import IOT_REGISTRY, available_iot_plugins
from protocol import (
    error_message,
    iot_heartbeat_message,
    iot_register_message,
    result_message,
    task_ack_message,
)
from signing import build_signable_result_payload, sign_result

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
)

DEFAULT_GATEWAY_ID = "gateway-sim-001"


class IoTGatewayNode:
    def __init__(self, gateway_id: str, cfg: NodeConfig) -> None:
        self.node_id = gateway_id
        self.cfg = cfg
        self.log = logging.getLogger(gateway_id)
        self.hostname = socket.gethostname()
        self.os_name = "IoT-Gateway-Sim"
        self.username = getpass.getuser()
        self._identity = load_or_create_identity(gateway_id)
        STORE.start_telemetry_loop(interval=2.0)

    async def run_forever(self) -> None:
        delay = self.cfg.reconnect_base_delay
        while True:
            try:
                await self._connect_once()
                delay = self.cfg.reconnect_base_delay
            except (OSError, websockets.WebSocketException) as exc:
                self.log.warning("Connection lost (%s). Reconnecting in %.1fs", exc, delay)
            except Exception as exc:
                self.log.exception("Unexpected error: %s", exc)
            await asyncio.sleep(delay)
            delay = min(delay * 2, self.cfg.reconnect_max_delay)

    async def _connect_once(self) -> None:
        self.log.info("IoT gateway connecting to %s", self.cfg.ws_url)
        async with websockets.connect(
            self.cfg.ws_url, max_size=self.cfg.max_message_bytes
        ) as ws:
            await ws.send(
                json.dumps(
                    iot_register_message(
                        self.node_id,
                        self.hostname,
                        self.os_name,
                        self.username,
                        self.cfg.shared_token,
                        self._identity["public_key"],
                        iot_snapshot=STORE.snapshot(),
                    )
                )
            )
            ack_raw = await ws.recv()
            ack = json.loads(ack_raw)
            if ack.get("type") == "error":
                raise RuntimeError(f"registration rejected: {ack.get('error')}")
            self.log.info(
                "Registered as IoT gateway. Plugins: %s",
                ", ".join(available_iot_plugins()),
            )

            hb_task = asyncio.create_task(self._heartbeat_loop(ws))
            try:
                async for raw in ws:
                    await self._handle_message(ws, raw)
            finally:
                hb_task.cancel()

    async def _heartbeat_loop(self, ws: Any) -> None:
        try:
            while True:
                await ws.send(
                    json.dumps(
                        iot_heartbeat_message(self.node_id, iot_snapshot=STORE.snapshot())
                    )
                )
                await asyncio.sleep(self.cfg.heartbeat_interval)
        except (asyncio.CancelledError, websockets.WebSocketException):
            return

    async def _handle_message(self, ws: Any, raw: str | bytes) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await ws.send(json.dumps(error_message(self.node_id, "invalid JSON")))
            return
        if msg.get("type") == "task":
            await self._execute_task(ws, msg)

    async def _execute_task(self, ws: Any, msg: dict[str, Any]) -> None:
        task_id = msg.get("task_id", "")
        mission_id = msg.get("mission_id", "")
        plugin_name = msg.get("plugin", "")
        args = msg.get("args", {}) or {}

        await ws.send(json.dumps(task_ack_message(task_id, self.node_id)))

        plugin = IOT_REGISTRY.get(plugin_name)
        start = time.perf_counter()

        if plugin is None:
            await self._send_result(
                ws,
                task_id=task_id,
                mission_id=mission_id,
                status="failed",
                stdout="",
                stderr=f"unknown IoT plugin: {plugin_name}",
                exit_code=1,
                duration_ms=0,
            )
            return

        loop = asyncio.get_running_loop()
        device_id = args.get("device_id", "")
        try:
            data = await asyncio.wait_for(
                loop.run_in_executor(None, plugin, args),
                timeout=self.cfg.task_timeout,
            )
            duration_ms = int((time.perf_counter() - start) * 1000)
            await self._send_result(
                ws,
                task_id=task_id,
                mission_id=mission_id,
                status="success",
                stdout=json.dumps(data, ensure_ascii=False),
                stderr="",
                exit_code=0,
                duration_ms=duration_ms,
                metadata={
                    "plugin": plugin_name,
                    "device_id": device_id,
                    "evidence_type": "iot_action",
                    "simulated": True,
                },
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.perf_counter() - start) * 1000)
            await self._send_result(
                ws,
                task_id=task_id,
                mission_id=mission_id,
                status="timeout",
                stdout="",
                stderr=f"IoT plugin '{plugin_name}' timed out",
                exit_code=124,
                duration_ms=duration_ms,
                metadata={"plugin": plugin_name, "evidence_type": "iot_action"},
            )
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start) * 1000)
            await self._send_result(
                ws,
                task_id=task_id,
                mission_id=mission_id,
                status="failed",
                stdout="",
                stderr=str(exc),
                exit_code=1,
                duration_ms=duration_ms,
                metadata={"plugin": plugin_name, "evidence_type": "iot_action"},
            )

    async def _send_result(self, ws: Any, **kwargs: Any) -> None:
        from protocol import now_iso

        timestamp = now_iso()
        meta = kwargs.pop("metadata", {}) or {}
        meta.setdefault("evidence_type", "iot_action")
        meta.setdefault("gateway_id", self.node_id)
        signable = build_signable_result_payload(
            task_id=kwargs["task_id"],
            mission_id=kwargs.get("mission_id", ""),
            node_id=self.node_id,
            status=kwargs["status"],
            stdout=kwargs.get("stdout", ""),
            stderr=kwargs.get("stderr", ""),
            exit_code=int(kwargs.get("exit_code", 0)),
            duration_ms=int(kwargs.get("duration_ms", 0)),
            timestamp=timestamp,
        )
        signature = sign_result(self._identity["private_key"], signable)
        await ws.send(
            json.dumps(
                result_message(
                    node_id=self.node_id,
                    node_signature=signature,
                    timestamp=timestamp,
                    metadata=meta,
                    **kwargs,
                )
            )
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulated IoT gateway for Aligo C2")
    parser.add_argument("--gateway-id", default=DEFAULT_GATEWAY_ID)
    parser.add_argument("--ws-url", default=None)
    parser.add_argument("--token", default=None)
    args = parser.parse_args()

    cfg = NodeConfig.from_env()
    if args.ws_url:
        cfg.ws_url = args.ws_url
    if args.token:
        cfg.shared_token = args.token

    try:
        asyncio.run(IoTGatewayNode(args.gateway_id, cfg).run_forever())
    except KeyboardInterrupt:
        logging.getLogger("iot").info("IoT gateway shutting down.")


if __name__ == "__main__":
    main()
