"""Aligo Mission Ledger C2 - laboratory agent.

Connects to the C2 over WebSocket, registers, heartbeats, and executes ONLY the safe
plugins in the local allowlist. Reconnects automatically with exponential backoff while
preserving its agent_id.

Usage:
    python agent.py --agent-id agent-001
    python agent.py --simulate-count 3
"""

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

from config import AgentConfig
from plugins import available_plugins, get_plugin
from protocol import (
    error_message,
    heartbeat_message,
    register_message,
    result_message,
    task_ack_message,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
)


class Agent:
    def __init__(self, agent_id: str, cfg: AgentConfig) -> None:
        self.agent_id = agent_id
        self.cfg = cfg
        self.log = logging.getLogger(agent_id)
        self.hostname = socket.gethostname()
        self.os_name = platform.system()
        self.username = getpass.getuser()

    async def run_forever(self) -> None:
        """Connect/reconnect loop with exponential backoff (agent_id preserved)."""
        delay = self.cfg.reconnect_base_delay
        while True:
            try:
                await self._connect_once()
                # Clean disconnect: reset backoff before reconnecting.
                delay = self.cfg.reconnect_base_delay
            except (OSError, websockets.WebSocketException) as exc:
                self.log.warning("Connection lost (%s). Reconnecting in %.1fs", exc, delay)
            except Exception as exc:  # pragma: no cover - defensive
                self.log.exception("Unexpected error: %s. Reconnecting in %.1fs", exc, delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, self.cfg.reconnect_max_delay)

    async def _connect_once(self) -> None:
        self.log.info("Connecting to %s", self.cfg.ws_url)
        async with websockets.connect(
            self.cfg.ws_url, max_size=self.cfg.max_message_bytes
        ) as ws:
            await ws.send(
                json.dumps(
                    register_message(
                        self.agent_id,
                        self.hostname,
                        self.os_name,
                        self.username,
                        self.cfg.shared_token,
                    )
                )
            )
            ack_raw = await ws.recv()
            ack = json.loads(ack_raw)
            if ack.get("type") == "error":
                raise RuntimeError(f"registration rejected: {ack.get('error')}")
            self.log.info("Registered. Plugins: %s", ", ".join(available_plugins()))

            hb_task = asyncio.create_task(self._heartbeat_loop(ws))
            try:
                async for raw in ws:
                    await self._handle_message(ws, raw)
            finally:
                hb_task.cancel()

    async def _heartbeat_loop(self, ws: Any) -> None:
        try:
            while True:
                await ws.send(json.dumps(heartbeat_message(self.agent_id)))
                await asyncio.sleep(self.cfg.heartbeat_interval)
        except (asyncio.CancelledError, websockets.WebSocketException):
            return

    async def _handle_message(self, ws: Any, raw: str | bytes) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await ws.send(json.dumps(error_message(self.agent_id, "invalid JSON")))
            return

        if msg.get("type") == "task":
            await self._execute_task(ws, msg)

    async def _execute_task(self, ws: Any, msg: dict[str, Any]) -> None:
        task_id = msg.get("task_id", "")
        mission_id = msg.get("mission_id", "")
        plugin_name = msg.get("plugin", "")
        args = msg.get("args", {}) or {}

        await ws.send(json.dumps(task_ack_message(task_id, self.agent_id)))

        plugin = get_plugin(plugin_name)
        start = time.perf_counter()

        if plugin is None:
            await self._send_result(
                ws,
                task_id=task_id,
                mission_id=mission_id,
                status="failed",
                stdout="",
                stderr=f"unknown or disallowed plugin: {plugin_name}",
                exit_code=1,
                duration_ms=0,
            )
            return

        loop = asyncio.get_running_loop()
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
                metadata={"plugin": plugin_name},
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.perf_counter() - start) * 1000)
            await self._send_result(
                ws,
                task_id=task_id,
                mission_id=mission_id,
                status="timeout",
                stdout="",
                stderr=f"plugin '{plugin_name}' timed out after {self.cfg.task_timeout}s",
                exit_code=124,
                duration_ms=duration_ms,
                metadata={"plugin": plugin_name},
            )
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start) * 1000)
            self.log.warning("Plugin %s failed: %s", plugin_name, exc)
            await self._send_result(
                ws,
                task_id=task_id,
                mission_id=mission_id,
                status="failed",
                stdout="",
                stderr=str(exc),
                exit_code=1,
                duration_ms=duration_ms,
                metadata={"plugin": plugin_name},
            )

    async def _send_result(self, ws: Any, **kwargs: Any) -> None:
        await ws.send(
            json.dumps(
                result_message(agent_id=self.agent_id, **kwargs)
            )
        )


async def _run_fleet(count: int, cfg: AgentConfig) -> None:
    agents = [Agent(f"agent-{i:03d}", cfg) for i in range(1, count + 1)]
    await asyncio.gather(*(a.run_forever() for a in agents))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aligo Mission Ledger C2 lab agent")
    parser.add_argument("--agent-id", default="agent-001", help="stable agent identifier")
    parser.add_argument(
        "--simulate-count",
        type=int,
        default=0,
        help="launch N simulated agents (agent-001..agent-00N) in one process",
    )
    parser.add_argument("--ws-url", default=None, help="override C2 WebSocket URL")
    parser.add_argument("--token", default=None, help="override shared agent token")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cfg = AgentConfig.from_env()
    if args.ws_url:
        cfg.ws_url = args.ws_url
    if args.token:
        cfg.shared_token = args.token

    try:
        if args.simulate_count and args.simulate_count > 0:
            logging.getLogger("fleet").info(
                "Launching %d simulated agents", args.simulate_count
            )
            asyncio.run(_run_fleet(args.simulate_count, cfg))
        else:
            asyncio.run(Agent(args.agent_id, cfg).run_forever())
    except KeyboardInterrupt:
        logging.getLogger("agent").info("Shutting down.")


if __name__ == "__main__":
    main()
