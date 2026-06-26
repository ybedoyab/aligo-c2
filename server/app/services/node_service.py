"""Node persistence and lifecycle logic."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.config import settings
from app.core.enums import NodeStatus, NodeType, TaskStatus
from app.core.policies import DEFAULT_POLICY_ID
from app.models.node import Node
from app.schemas.node import NodeHealthExplanation, NodeHealthFactor, NodeRegister, NodeUpdate
from app.services import result_service, task_service


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _infer_node_type(node_id: str) -> NodeType:
    if node_id.startswith("ai-"):
        return NodeType.AI_ANALYST
    if node_id.startswith("node-"):
        return NodeType.SIMULATED
    return NodeType.REAL


def register_node(session: Session, reg: NodeRegister) -> tuple[Node, bool]:
    """Create or update a node on registration."""
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
            node_type=_infer_node_type(reg.node_id),
            policy_id=DEFAULT_POLICY_ID,
        )
    else:
        node.hostname = reg.hostname or node.hostname
        node.os = reg.os or node.os
        node.username = reg.username or node.username
        if not node.enabled:
            node.status = NodeStatus.OFFLINE
        else:
            node.status = NodeStatus.ONLINE
            node.health_score = min(100, node.health_score + 5)
        node.last_seen = now
    session.add(node)
    session.commit()
    session.refresh(node)
    return node, is_new


def update_node(session: Session, node_id: str, patch: NodeUpdate) -> Node | None:
    node = session.get(Node, node_id)
    if node is None:
        return None
    data = patch.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(node, key, value)
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def delete_node(session: Session, node_id: str) -> bool:
    """Remove an offline node from the registry."""
    node = session.get(Node, node_id)
    if node is None:
        return False
    if node.status != NodeStatus.OFFLINE:
        raise ValueError("only offline nodes may be deleted from the registry")
    session.delete(node)
    session.commit()
    return True


def heartbeat(session: Session, node_id: str) -> Node | None:
    node = session.get(Node, node_id)
    if node is None or not node.enabled:
        return None
    node.last_seen = _utcnow()
    node.status = NodeStatus.ONLINE
    node.health_score = min(100, compute_health_score(session, node))
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
        if elapsed >= settings.heartbeat_offline_seconds:
            new_status = NodeStatus.OFFLINE
        elif elapsed >= settings.heartbeat_warning_seconds:
            new_status = NodeStatus.WARNING
        if new_status != node.status:
            node.status = new_status
            node.health_score = compute_health_score(session, node)
            session.add(node)
            changed.append(node)
    if changed:
        session.commit()
        for node in changed:
            session.refresh(node)
    return changed


def list_nodes(
    session: Session,
    *,
    status: str | None = None,
    os_name: str | None = None,
    group: str | None = None,
    tag: str | None = None,
    min_health: int | None = None,
) -> list[Node]:
    nodes = list(session.exec(select(Node).order_by(Node.id)).all())
    if status:
        nodes = [n for n in nodes if n.status == status]
    if os_name:
        needle = os_name.lower()
        nodes = [n for n in nodes if needle in (n.os or "").lower()]
    if group:
        nodes = [n for n in nodes if n.group == group]
    if tag:
        nodes = [n for n in nodes if tag in (n.tags or [])]
    if min_health is not None:
        nodes = [n for n in nodes if n.health_score >= min_health]
    return nodes


def get_node(session: Session, node_id: str) -> Node | None:
    return session.get(Node, node_id)


def compute_health_score(session: Session, node: Node) -> int:
    return explain_health(session, node).total_score


def explain_health(session: Session, node: Node) -> NodeHealthExplanation:
    tasks = task_service.list_tasks_for_node(session, node.id, limit=50)
    terminal = {TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.TIMEOUT, TaskStatus.BLOCKED_BY_POLICY}
    done = [t for t in tasks if t.status in terminal]
    successes = sum(1 for t in done if t.status == TaskStatus.SUCCESS)
    success_rate = (successes / len(done)) if done else 1.0

    latencies: list[int] = []
    errors = 0
    for t in done:
        res = result_service.get_result_for_task(session, t.id)
        if res and res.duration_ms is not None:
            latencies.append(res.duration_ms)
        if t.status in {TaskStatus.FAILED, TaskStatus.TIMEOUT, TaskStatus.BLOCKED_BY_POLICY}:
            errors += 1

    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

    # Heartbeat component
    if not node.enabled:
        hb_score, hb_detail = 0, "node is disabled in registry"
    elif node.status == NodeStatus.ONLINE:
        hb_score, hb_detail = 100, "heartbeat current — node online"
    elif node.status == NodeStatus.WARNING:
        hb_score, hb_detail = 50, "heartbeat delayed — warning state"
    else:
        hb_score, hb_detail = 0, "node offline or unreachable"

    task_score = int(success_rate * 100)
    task_detail = (
        f"{successes}/{len(done)} recent tasks succeeded"
        if done
        else "no completed tasks yet (assumed healthy)"
    )

    if avg_latency <= 500:
        latency_score = 100
        latency_detail = f"avg latency {avg_latency:.0f} ms"
    elif avg_latency <= 2000:
        latency_score = 70
        latency_detail = f"avg latency {avg_latency:.0f} ms (moderate)"
    else:
        latency_score = 40
        latency_detail = f"avg latency {avg_latency:.0f} ms (high)"

    error_penalty = min(40, errors * 10)
    error_score = max(0, 100 - error_penalty)
    error_detail = f"{errors} recent error(s)/blocked task(s)"

    total = int(hb_score * 0.4 + task_score * 0.35 + latency_score * 0.15 + error_score * 0.1)
    total = max(0, min(100, total))

    return NodeHealthExplanation(
        total_score=total,
        factors=[
            NodeHealthFactor(label="Heartbeat", score=hb_score, detail=hb_detail),
            NodeHealthFactor(label="Task success rate", score=task_score, detail=task_detail),
            NodeHealthFactor(label="Average latency", score=latency_score, detail=latency_detail),
            NodeHealthFactor(label="Recent errors", score=error_score, detail=error_detail),
        ],
    )
