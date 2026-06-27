"""Agent backend: FastAPI app exposing POST /chat (SSE stream) and GET /health.

The browser/operator UI talks to THIS backend; this backend talks to the C2 server.
The browser never calls the C2 directly, so the C2's CORS config needs no change.

/chat is a turn-based SSE endpoint over a LangGraph session keyed by `session_id`:
  - Send {"session_id", "message"} to start/continue a turn.
  - If the agent proposes a gated action, the stream emits an `approval_request`
    event and pauses (LangGraph interrupt). Reply with
    {"session_id", "approval": {"approved": bool, "feedback"?: str}} to resume.

SSE events emitted: token | tool_call | tool_result | approval_request | error | done.
"""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage
from langgraph.types import Command
from pydantic import BaseModel

from app import __version__
from app.c2_client import close_c2, get_c2
from app.config import settings
from app.graph import get_graph
from app.ws_listener import listener, live_state

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s: %(message)s")
logger = logging.getLogger("agent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_graph()  # build + cache the compiled graph at startup
    listener.start()  # background operator-WS subscriber (Phase 4 live state)
    logger.info("Aligo Agent started (v%s) -> C2 %s", __version__, settings.c2_base_url)
    try:
        yield
    finally:
        await listener.stop()
        await close_c2()


app = FastAPI(title="Aligo Agent", version=__version__, lifespan=lifespan)

# The agent UI may be served from the React dev server; allow the same dev origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApprovalDecision(BaseModel):
    approved: bool
    feedback: str | None = None


class ChatRequest(BaseModel):
    session_id: str
    message: str | None = None
    approval: ApprovalDecision | None = None


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _chunk_text(content: Any) -> str:
    """Extract plain text from an AIMessageChunk content (str or Anthropic block list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out: list[str] = []
        for block in content:
            if isinstance(block, str):
                out.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                out.append(block.get("text", ""))
        return "".join(out)
    return ""


async def _run(req: ChatRequest) -> AsyncIterator[str]:
    graph = get_graph()
    config: dict[str, Any] = {"configurable": {"thread_id": req.session_id}}

    if req.approval is not None:
        payload: Any = Command(resume=req.approval.model_dump())
    elif req.message is not None:
        payload = {"messages": [HumanMessage(content=req.message)]}
    else:
        yield _sse("error", {"detail": "provide either 'message' or 'approval'"})
        yield _sse("done", {"awaiting_approval": False})
        return

    if req.approval is not None:
        logger.info("chat[%s]: resume approval=%s", req.session_id, req.approval.approved)
    else:
        preview = (req.message or "")[:120]
        logger.info("chat[%s]: turn start (model=%s) msg=%r", req.session_id, settings.agent_model, preview)

    awaiting_approval = False
    try:
        async for mode, chunk in graph.astream(payload, config, stream_mode=["updates", "messages"]):
            if mode == "messages":
                msg_chunk, meta = chunk
                if isinstance(msg_chunk, AIMessageChunk) and meta.get("langgraph_node") == "agent":
                    text = _chunk_text(msg_chunk.content)
                    if text:
                        yield _sse("token", {"text": text})
                continue

            # mode == "updates": dict of node -> state update, or an interrupt marker
            if "__interrupt__" in chunk:
                interrupts = chunk["__interrupt__"]
                value = interrupts[0].value if interrupts else {}
                awaiting_approval = True
                yield _sse("approval_request", value)
                continue

            agent_update = chunk.get("agent")
            if agent_update:
                for m in agent_update.get("messages", []):
                    if isinstance(m, AIMessage) and m.tool_calls:
                        for tc in m.tool_calls:
                            logger.info("chat[%s]: tool_call %s %s", req.session_id, tc["name"], tc["args"])
                            yield _sse("tool_call", {"tool": tc["name"], "args": tc["args"]})

            tools_update = chunk.get("tools")
            if tools_update:
                for m in tools_update.get("messages", []):
                    if isinstance(m, ToolMessage):
                        yield _sse("tool_result", {"tool": m.name, "content": _truncate(m.content)})
    except Exception as exc:  # noqa: BLE001
        logger.exception("chat run failed")
        yield _sse("error", {"detail": str(exc)})

    logger.info("chat[%s]: turn done (awaiting_approval=%s)", req.session_id, awaiting_approval)
    yield _sse("done", {"awaiting_approval": awaiting_approval})


def _truncate(content: Any, limit: int = 2000) -> str:
    text = content if isinstance(content, str) else json.dumps(content, default=str)
    return text if len(text) <= limit else text[:limit] + "…(truncated)"


@app.post("/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _run(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    c2_ok = False
    c2_detail = "unreachable"
    try:
        h = await get_c2().health()
        c2_ok = True
        c2_detail = h.get("status", "ok")
    except Exception as exc:  # noqa: BLE001
        c2_detail = str(exc)
    return {
        "status": "ok",
        "version": __version__,
        "model": settings.agent_model,
        "anthropic_key_configured": bool(settings.anthropic_api_key),
        "c2_base_url": settings.c2_base_url,
        "c2_reachable": c2_ok,
        "c2_detail": c2_detail,
        "ws_connected": live_state.connected,
    }


@app.get("/")
async def root() -> dict[str, Any]:
    return {"name": "Aligo Agent", "version": __version__, "note": "Authorized lab use only."}
