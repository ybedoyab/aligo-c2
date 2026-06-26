"""Node persistence and lifecycle logic."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.config import settings
from app.core.enums import NodeStatus
from app.models.node import Node
from app.schemas.node import NodeRegister


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def register_node(session: Session, reg: NodeRegister) -> tuple[Node, bool]:
    """Create or update an node on registration.

    Returns (node, is_new) where is_new distinguishes a first registration from a
    reconnection (used to choose NODE_REGISTERED vs NODE_RECONNECTED ledger events).
    """
    node = session.get(Node, reg.node_id)
    is_new = node is None
    now = _utcnow()
    if node is None:
        node = Node(
            id=reg.node_id,
            hostname=reg.hostname,
            os=reg.os,
            username=reg.username,
            status=NodeStatus.ONLINE,
            health_score=100,
            first_seen=now,
            last_seen=now,
            registered_at=now,
        )
    else:
        node.hostname = reg.hostname or node.hostname
        node.os = reg.os or node.os
        node.username = reg.username or node.username
        node.status = NodeStatus.ONLINE
        node.health_score = 100
        node.last_seen = now
        node.registered_at = now
    session.add(node)
    session.commit()
    session.refresh(node)
    return node, is_new


def heartbeat(session: Session, node_id: str) -> Node | None:
    """Record a heartbeat: refresh last_seen and restore online status."""
    node = session.get(Node, node_id)
    if node is None:
        return None
    node.last_seen = _utcnow()
    node.status = NodeStatus.ONLINE
    node.health_score = min(100, node.health_score + 5)
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def mark_disconnected(session: Session, node_id: str) -> Node | None:
    node = session.get(Node, node_id)
    if node is None:
        return None
    node.status = NodeStatus.OFFLINE
    node.health_score = 0
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def reconcile_statuses(session: Session) -> list[Node]:
    """Downgrade nodes whose heartbeats have lapsed. Returns the changed nodes."""
    now = _utcnow()
    changed: list[Node] = []
    nodes = session.exec(select(Node)).all()
    for node in nodes:
        if node.status == NodeStatus.OFFLINE:
            continue
        last_seen = node.last_seen
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        elapsed = (now - last_seen).total_seconds()
        new_status = node.status
        new_score = node.health_score
        if elapsed >= settings.heartbeat_offline_seconds:
            new_status = NodeStatus.OFFLINE
            new_score = 0
        elif elapsed >= settings.heartbeat_warning_seconds:
            new_status = NodeStatus.WARNING
            new_score = max(40, node.health_score - 30)
        if new_status != node.status or new_score != node.health_score:
            node.status = new_status
            node.health_score = new_score
            session.add(node)
            changed.append(node)
    if changed:
        session.commit()
        for node in changed:
            session.refresh(node)
    return changed


def list_nodes(session: Session) -> list[Node]:
    return list(session.exec(select(Node).order_by(Node.id)).all())


def get_node(session: Session, node_id: str) -> Node | None:
    return session.get(Node, node_id)
