"""LangChain tools = thin wrappers over c2_client.

Read tools are unrestricted. Write tools are split out and only the gated ones
(`start_mission`, `create_adhoc_task`, `start_sample_mission`) actually execute on
nodes — the graph routes those through an operator-approval interrupt first.

The plugin allowlist + arg schemas below are derived directly from the source in
`node/plugins/*.py` (NOT from the plan, which had `echo` slightly wrong). The agent
must only ever propose these plugins with these args; the server's Pydantic
validator is the hard 422 backstop, but we never rely on it.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx
from langchain_core.tools import tool

from app.c2_client import get_c2
from app.ws_listener import live_state

# --- Plugin allowlist (mirrors node/plugins + server ALLOWED_PLUGINS) ---------
PLUGIN_CATALOG: list[dict[str, Any]] = [
    {"plugin": "system_info", "args": {}, "desc": "Safe local system facts (os, hostname, cpu, memory)."},
    {"plugin": "health_check", "args": {}, "desc": "Node uptime, timestamp, latency, status."},
    {
        "plugin": "echo",
        "args": {"text": "string"},
        "desc": "Return the supplied text unchanged. NOTE: the arg key is 'text', not 'message'.",
    },
    {"plugin": "network_info", "args": {}, "desc": "Local hostname + interface info. Does NOT scan external networks."},
    {
        "plugin": "list_lab_directory",
        "args": {"path": "string (optional, relative; sandboxed to node/lab_workspace)"},
        "desc": "List files inside the lab workspace sandbox only.",
    },
    {
        "plugin": "allowed_command",
        "args": {"command": "one of: whoami | hostname | pwd | date"},
        "desc": "Run ONLY a fixed allowlist of harmless informational commands. No free-form shell.",
    },
]
ALLOWED_PLUGINS = frozenset(item["plugin"] for item in PLUGIN_CATALOG)

# Tools that EXECUTE on nodes. The graph requires operator approval before these run.
GATED_TOOLS = frozenset({"start_mission", "create_adhoc_task", "start_sample_mission"})

_TERMINAL_TASK_STATES = frozenset({"success", "failed", "timeout"})


def _ok(data: Any) -> str:
    return json.dumps(data, default=str)


def _err(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        detail: Any
        try:
            detail = exc.response.json()
        except Exception:  # noqa: BLE001
            detail = exc.response.text
        return json.dumps({"error": "c2_http_error", "status": exc.response.status_code, "detail": detail})
    if isinstance(exc, httpx.RequestError):
        return json.dumps({"error": "c2_unreachable", "detail": str(exc)})
    return json.dumps({"error": exc.__class__.__name__, "detail": str(exc)})


# ============================ READ TOOLS (unrestricted) ======================

@tool
async def list_plugins() -> str:
    """List the allowlisted plugins the agent may target, with their exact arg schemas.
    Always use this to choose a plugin; never invent a plugin or argument."""
    return _ok(PLUGIN_CATALOG)


@tool
async def list_nodes() -> str:
    """List all known C2 nodes with status, health_score and last_seen."""
    try:
        return _ok(await get_c2().list_nodes())
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def get_node_detail(node_id: str) -> str:
    """Get detailed stats and task history for a single node."""
    try:
        return _ok(await get_c2().get_node_detail(node_id))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def node_connected(node_id: str) -> str:
    """Check whether a node currently has a live socket connection."""
    try:
        return _ok(await get_c2().node_connected(node_id))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def list_missions() -> str:
    """List all missions, including seeded predefined ones and any drafts."""
    try:
        return _ok(await get_c2().list_missions())
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def get_mission(mission_id: str) -> str:
    """Get a single mission by id (name, status, steps, target nodes)."""
    try:
        return _ok(await get_c2().get_mission(mission_id))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def list_tasks(mission_id: str | None = None, node_id: str | None = None) -> str:
    """List tasks, optionally filtered by mission_id and/or node_id."""
    try:
        return _ok(await get_c2().list_tasks(mission_id, node_id))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def get_task_evidence(task_id: str) -> str:
    """Get evidence for a task: stdout/stderr, exit code, hashes and ledger linkage."""
    try:
        return _ok(await get_c2().get_task_evidence(task_id))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def list_results(mission_id: str | None = None) -> str:
    """List task results, optionally filtered by mission_id."""
    try:
        return _ok(await get_c2().list_results(mission_id))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def list_ledger_events() -> str:
    """List Proof-of-Execution ledger events (hash-chained, optionally on-chain)."""
    try:
        return _ok(await get_c2().list_ledger_events())
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def verify_ledger_event(event_id: str) -> str:
    """Verify a ledger event's integrity (recompute hash / check on-chain) -> verified|tampered."""
    try:
        return _ok(await get_c2().verify_ledger_event(event_id))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def ledger_status() -> str:
    """Get blockchain connectivity / ledger status for the operator UI."""
    try:
        return _ok(await get_c2().ledger_status())
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def ledger_stats() -> str:
    """Get ledger statistics: total/anchored/pending/verified/tampered event counts."""
    try:
        return _ok(await get_c2().ledger_stats())
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def get_live_state() -> str:
    """Get the live C2 snapshot fed by the operator WebSocket (online nodes, recent events)."""
    return _ok(live_state.snapshot())


@tool
async def wait_for_mission_completion(mission_id: str, timeout_seconds: int = 60) -> str:
    """Wait until every task of a mission reaches a terminal state (success/failed/timeout),
    then return the tasks plus their results. Use this after starting a mission to observe
    its outcome. Polls the C2; returns early once all tasks are terminal or on timeout."""
    c2 = get_c2()
    deadline = time.monotonic() + max(1, timeout_seconds)
    tasks: list[dict[str, Any]] = []
    try:
        while True:
            tasks = await c2.list_tasks(mission_id=mission_id)
            terminal = bool(tasks) and all(
                t.get("status") in _TERMINAL_TASK_STATES for t in tasks
            )
            if terminal or time.monotonic() >= deadline:
                break
            await asyncio.sleep(2)
        results = await c2.list_results(mission_id=mission_id)
        return _ok({
            "mission_id": mission_id,
            "all_terminal": bool(tasks) and all(t.get("status") in _TERMINAL_TASK_STATES for t in tasks),
            "tasks": tasks,
            "results": results,
        })
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


# ============================ WRITE TOOLS ====================================

@tool
async def create_mission_draft(
    name: str,
    steps: list[dict[str, Any]],
    description: str = "",
    target_node_ids: list[str] | None = None,
) -> str:
    """Create a DRAFT mission. This does NOT execute anything on nodes — it only defines
    the plan, so it is safe to call before approval. Each step is {"plugin": <allowed>,
    "args": {...}}; use list_plugins for the exact arg schema. `target_node_ids` may be
    empty to decide targets at start time. Returns the created draft (with its id)."""
    bad = [s.get("plugin") for s in steps if s.get("plugin") not in ALLOWED_PLUGINS]
    if bad:
        return json.dumps({
            "error": "disallowed_plugin",
            "detail": f"plugins not in allowlist: {bad}",
            "allowed": sorted(ALLOWED_PLUGINS),
        })
    payload: dict[str, Any] = {
        "name": name,
        "description": description,
        "steps": steps,
        "target_node_ids": target_node_ids or [],
    }
    try:
        return _ok(await get_c2().create_mission(payload))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def start_mission(mission_id: str, target_node_ids: list[str] | None = None) -> str:
    """EXECUTE a draft mission on nodes. This is the gated action — it runs tasks on
    real nodes and anchors them in the ledger. Requires operator approval. If
    target_node_ids is omitted, the server falls back to the mission default, then all
    connected nodes."""
    try:
        return _ok(await get_c2().start_mission(mission_id, target_node_ids))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def create_adhoc_task(plugin: str, node_id: str, args: dict[str, Any] | None = None) -> str:
    """EXECUTE a single ad-hoc task on one node immediately. Gated action; requires
    operator approval. `plugin` must be in the allowlist (see list_plugins)."""
    if plugin not in ALLOWED_PLUGINS:
        return json.dumps({
            "error": "disallowed_plugin",
            "detail": f"'{plugin}' not in allowlist",
            "allowed": sorted(ALLOWED_PLUGINS),
        })
    payload = {"node_id": node_id, "plugin": plugin, "args": args or {}, "mission_id": None}
    try:
        return _ok(await get_c2().create_task(payload))
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


@tool
async def start_sample_mission() -> str:
    """EXECUTE the predefined Lab Health Check across all connected nodes (one-click demo).
    Gated action; requires operator approval."""
    try:
        return _ok(await get_c2().start_sample_mission())
    except Exception as exc:  # noqa: BLE001
        return _err(exc)


READ_TOOLS = [
    list_plugins,
    list_nodes,
    get_node_detail,
    node_connected,
    list_missions,
    get_mission,
    list_tasks,
    get_task_evidence,
    list_results,
    list_ledger_events,
    verify_ledger_event,
    ledger_status,
    ledger_stats,
    get_live_state,
    wait_for_mission_completion,
]

# create_mission_draft is a write that does NOT execute -> allowed pre-approval.
SAFE_WRITE_TOOLS = [create_mission_draft]

# These EXECUTE on nodes -> only reachable through the post-approval branch.
GATED_WRITE_TOOLS = [start_mission, create_adhoc_task, start_sample_mission]

ALL_TOOLS = READ_TOOLS + SAFE_WRITE_TOOLS + GATED_WRITE_TOOLS
