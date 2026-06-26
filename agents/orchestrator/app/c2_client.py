"""Async HTTP client wrapping the C2 REST contract.

This is the ONLY module in the agent that performs network I/O to the C2 server.
Keeping the contract in one place makes it trivial to audit what the agent can do:
every action a tool drives goes through a method here, which maps 1:1 to a public
REST endpoint documented in agent-plan.md §1.

No method here talks to nodes, the DB, or server internals. Read methods are
unrestricted; the two methods that *execute* on nodes — `start_mission`,
`create_task`, `start_sample_mission` — are only ever reached from the agent's
post-approval branch (see graph.py).
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class C2Client:
    """Thin async wrapper over the C2 operator REST API."""

    def __init__(self, base_url: str | None = None, timeout: float | None = None) -> None:
        self._base_url = (base_url or settings.c2_base_url).rstrip("/")
        self._timeout = timeout or settings.c2_request_timeout
        self._client: httpx.AsyncClient | None = None

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=self._base_url, timeout=self._timeout)
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        resp = await self._http().get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        resp = await self._http().post(path, json=json)
        resp.raise_for_status()
        return resp.json()

    # --- meta ---------------------------------------------------------------
    async def health(self) -> Any:
        return await self._get("/health")

    # --- nodes (read-only) --------------------------------------------------
    async def list_nodes(self) -> Any:
        return await self._get("/api/nodes")

    async def get_node_detail(self, node_id: str) -> Any:
        return await self._get(f"/api/nodes/{node_id}/detail")

    async def node_connected(self, node_id: str) -> Any:
        return await self._get(f"/api/nodes/{node_id}/connected")

    # --- missions -----------------------------------------------------------
    async def list_missions(self) -> Any:
        return await self._get("/api/missions")

    async def get_mission(self, mission_id: str) -> Any:
        return await self._get(f"/api/missions/{mission_id}")

    async def create_mission(self, payload: dict[str, Any]) -> Any:
        """Create a DRAFT mission. Does NOT execute — safe pre-approval."""
        return await self._post("/api/missions", json=payload)

    async def start_mission(
        self, mission_id: str, target_node_ids: list[str] | None = None
    ) -> Any:
        """EXECUTES the mission on nodes. Gated action."""
        body = {"target_node_ids": target_node_ids} if target_node_ids else None
        return await self._post(f"/api/missions/{mission_id}/start", json=body)

    # --- tasks --------------------------------------------------------------
    async def list_tasks(
        self, mission_id: str | None = None, node_id: str | None = None
    ) -> Any:
        params: dict[str, Any] = {}
        if mission_id:
            params["mission_id"] = mission_id
        if node_id:
            params["node_id"] = node_id
        return await self._get("/api/tasks", params=params or None)

    async def get_task_evidence(self, task_id: str) -> Any:
        return await self._get(f"/api/tasks/{task_id}/evidence")

    async def create_task(self, payload: dict[str, Any]) -> Any:
        """Create + dispatch a single ad-hoc task. EXECUTES immediately. Gated."""
        return await self._post("/api/tasks", json=payload)

    # --- results ------------------------------------------------------------
    async def list_results(self, mission_id: str | None = None) -> Any:
        params = {"mission_id": mission_id} if mission_id else None
        return await self._get("/api/results", params=params)

    # --- ledger -------------------------------------------------------------
    async def list_ledger_events(self) -> Any:
        return await self._get("/api/ledger/events")

    async def verify_ledger_event(self, event_id: str) -> Any:
        return await self._post(f"/api/ledger/events/{event_id}/verify")

    async def ledger_status(self) -> Any:
        return await self._get("/api/ledger/status")

    async def ledger_stats(self) -> Any:
        return await self._get("/api/ledger/stats")

    # --- demo (executes) ----------------------------------------------------
    async def start_sample_mission(self) -> Any:
        """One-click Lab Health Check on all connected nodes. EXECUTES. Gated."""
        return await self._post("/api/demo/start-sample-mission")


# Module-level singleton reused by tools and the ws listener.
_client: C2Client | None = None


def get_c2() -> C2Client:
    global _client
    if _client is None:
        _client = C2Client()
    return _client


async def close_c2() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
