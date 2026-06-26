"""Node REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.node import NodeDetailRead, NodeRead, NodeUpdate
from app.services import node_service, evidence_service
from app.websocket.manager import manager

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


@router.get("", response_model=list[NodeRead])
def list_nodes(
    status: str | None = Query(default=None),
    os: str | None = Query(default=None, alias="os"),
    group: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    min_health: int | None = Query(default=None, ge=0, le=100),
    session: Session = Depends(get_session),
) -> list[NodeRead]:
    nodes = node_service.list_nodes(
        session,
        status=status,
        os_name=os,
        group=group,
        tag=tag,
        min_health=min_health,
    )
    return [NodeRead.model_validate(n) for n in nodes]


@router.get("/{node_id}", response_model=NodeRead)
def get_node(node_id: str, session: Session = Depends(get_session)) -> NodeRead:
    node = node_service.get_node(session, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="node not found")
    return NodeRead.model_validate(node)


@router.patch("/{node_id}", response_model=NodeRead)
def patch_node(
    node_id: str,
    payload: NodeUpdate,
    session: Session = Depends(get_session),
) -> NodeRead:
    node = node_service.update_node(session, node_id, payload)
    if node is None:
        raise HTTPException(status_code=404, detail="node not found")
    return NodeRead.model_validate(node)


@router.delete("/{node_id}", status_code=204, response_class=Response)
def remove_node(node_id: str, session: Session = Depends(get_session)) -> Response:
    if manager.is_node_connected(node_id):
        raise HTTPException(status_code=409, detail="node is still connected")
    try:
        deleted = node_service.delete_node(session, node_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="node not found")
    return Response(status_code=204)


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
