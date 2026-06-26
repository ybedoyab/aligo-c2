"""Aligo Mission Ledger C2 - FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app import __version__
from app.api import agents, demo, ledger, missions, results, tasks
from app.blockchain.contract_client import get_contract_client
from app.core.config import settings
from app.db.database import engine, init_db
from app.db.seed import seed_predefined_missions
from app.schemas.agent import AgentRead
from app.services import agent_service
from app.websocket import notifier
from app.websocket.agent_socket import agent_endpoint
from app.websocket.operator_socket import operator_endpoint

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("aligo")


async def _heartbeat_monitor() -> None:
    """Periodically downgrade agents whose heartbeats lapsed and broadcast changes."""
    interval = settings.heartbeat_monitor_interval_seconds
    while True:
        try:
            await asyncio.sleep(interval)
            with Session(engine) as session:
                changed = agent_service.reconcile_statuses(session)
                payloads = [
                    AgentRead.model_validate(a).model_dump(mode="json") for a in changed
                ]
            for payload in payloads:
                await notifier.broadcast({"type": "agent_update", "data": payload})
        except asyncio.CancelledError:  # pragma: no cover
            break
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("heartbeat monitor error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_predefined_missions()
    client = get_contract_client()
    logger.info("Ledger status: %s", client.reason)
    monitor = asyncio.create_task(_heartbeat_monitor())
    logger.info("Aligo Mission Ledger C2 server started (v%s)", __version__)
    try:
        yield
    finally:
        monitor.cancel()


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

app.include_router(agents.router)
app.include_router(missions.router)
app.include_router(tasks.router)
app.include_router(results.router)
app.include_router(ledger.router)
app.include_router(demo.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    client = get_contract_client()
    return {
        "status": "ok",
        "version": __version__,
        "ledger_enabled": settings.ledger_enabled,
        "ledger_available": client.available,
        "ledger_detail": client.reason,
    }


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": "Aligo Mission Ledger C2",
        "version": __version__,
        "docs": "/docs",
        "note": "Authorized laboratory use only.",
    }


@app.websocket("/ws/agent")
async def ws_agent(websocket: WebSocket) -> None:
    await agent_endpoint(websocket)


@app.websocket("/ws/operator")
async def ws_operator(websocket: WebSocket) -> None:
    await operator_endpoint(websocket)
