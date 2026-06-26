"""Node REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.node import NodeDetailRead, NodeRead
from app.services import node_service, evidence_service
from app.websocket.manager import manager

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


@router.get("", response_model=list[NodeRead])
def list_nodes(session: Session = Depends(get_session)) -> list[NodeRead]:
    nodes = node_service.list_nodes(session)
    return [NodeRead.model_validate(a) for a in nodes]


@router.get("/{node_id}", response_model=NodeRead)
def get_node(node_id: str, session: Session = Depends(get_session)) -> NodeRead:
    node = node_service.get_node(session, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="node not found")
    return NodeRead.model_validate(node)


@router.get("/{node_id}/detail", response_model=NodeDetailRead)
def get_node_detail(
    node_id: str, session: Session = Depends(get_session)
) -> NodeDetailRead:
    detail = evidence_service.get_node_detail(session, node_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="node not found")
    return detail


@router.get("/{node_id}/connected")
def node_connected(node_id: str) -> dict:
    return {"node_id": node_id, "connected": manager.is_node_connected(node_id)}
