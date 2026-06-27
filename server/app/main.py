"""Aligo Mission Ledger C2 - FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app import __version__
from app.api import nodes, demo, evidence, iot, ledger, missions, policies, results, tasks, vulnerabilities
from app.blockchain.contract_client import get_contract_client
from app.core.config import settings
from app.core.enums import VulnScanTrigger
from app.db.database import engine, init_db
from app.db.seed import seed_predefined_missions
from app.schemas.node import NodeRead
from app.services import ledger_service, node_service
from app.websocket import notifier
from app.websocket.node_socket import node_endpoint
from app.websocket.operator_socket import operator_endpoint

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("aligo")


async def _heartbeat_monitor() -> None:
    """Periodically downgrade nodes whose heartbeats lapsed and broadcast changes."""
    interval = settings.heartbeat_monitor_interval_seconds
    while True:
        try:
            await asyncio.sleep(interval)
            with Session(engine) as session:
                changed = node_service.reconcile_statuses(session)
                payloads = [
                    NodeRead.model_validate(a).model_dump(mode="json") for a in changed
                ]
            for payload in payloads:
                await notifier.broadcast({"type": "node_update", "data": payload})
        except asyncio.CancelledError:  # pragma: no cover
            break
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("heartbeat monitor error: %s", exc)


async def _sync_ledger_with_chain() -> None:
    """Background: fix stale anchors after Hardhat restart and anchor pending events."""
    try:
        # Let the API, dashboard, and nodes finish binding before bulk anchoring.
        await asyncio.sleep(3)
        summary = await asyncio.to_thread(_sync_ledger_blocking)
        logger.info(
            "Ledger chain sync complete: %d stale reset, %d re-anchored",
            summary.get("stale_reset", 0),
            summary.get("re_anchored", 0),
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("ledger chain sync failed: %s", exc)


def _sync_ledger_blocking() -> dict[str, int]:
    with Session(engine) as session:
        return ledger_service.ensure_chain_sync(session)


async def _vuln_scan_scheduler() -> None:
    """Run vulnerability scans on a configurable interval (default daily)."""
    if not settings.vuln_scan_cron_enabled:
        logger.info("Vulnerability scan cron disabled")
        return

    interval_seconds = max(60.0, settings.vuln_scan_interval_hours * 3600.0)
    logger.info(
        "Vulnerability scan scheduler started (interval %.1f hours)",
        settings.vuln_scan_interval_hours,
    )
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            logger.info("Cron vulnerability scan starting")
            await vuln_scan_service.trigger_scan(trigger=VulnScanTrigger.CRON)
        except asyncio.CancelledError:
            break
        except ValueError as exc:
            logger.warning("Cron vulnerability scan skipped: %s", exc)
        except Exception as exc:  # pragma: no cover
            logger.exception("vuln scan scheduler error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services import vuln_scan_service

    init_db()
    seed_predefined_missions()
    with Session(engine) as session:
        vuln_scan_service.ensure_vuln_recon_mission(session)
    client = get_contract_client()
    logger.info("Ledger status: %s", client.reason)
    sync_task = asyncio.create_task(_sync_ledger_with_chain())
    monitor = asyncio.create_task(_heartbeat_monitor())
    vuln_scheduler = asyncio.create_task(_vuln_scan_scheduler())
    logger.info("Aligo Mission Ledger C2 server started (v%s)", __version__)
    try:
        yield
    finally:
        sync_task.cancel()
        monitor.cancel()
        vuln_scheduler.cancel()


app = FastAPI(
    title="Aligo Mission Ledger C2",
    version=__version__,
    description="Lab-only Command & Control with a blockchain-backed Proof-of-Execution Ledger.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nodes.router)
app.include_router(policies.router)
app.include_router(missions.router)
app.include_router(tasks.router)
app.include_router(results.router)
app.include_router(ledger.router)
app.include_router(evidence.router)
app.include_router(demo.router)
app.include_router(iot.router)
app.include_router(vulnerabilities.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    import os

    from app.services import ledger_service

    chain = ledger_service.get_chain_status()
    payload = {
        "status": "ok",
        "version": __version__,
        "ledger_enabled": settings.ledger_enabled,
        "ledger_available": chain.client_available,
        "ledger_detail": chain.detail,
        "chain_status": chain.status,
        "contract_address": chain.contract_address,
    }
    nonce = os.environ.get("DEV_STARTUP_NONCE")
    if nonce:
        payload["startup_nonce"] = nonce
    return payload


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": "Aligo Mission Ledger C2",
        "version": __version__,
        "docs": "/docs",
        "note": "Authorized laboratory use only.",
    }


@app.websocket("/ws/node")
async def ws_node(websocket: WebSocket) -> None:
    await node_endpoint(websocket)


@app.websocket("/ws/operator")
async def ws_operator(websocket: WebSocket) -> None:
    await operator_endpoint(websocket)
