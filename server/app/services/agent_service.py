"""Agent persistence and lifecycle logic."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.config import settings
from app.core.enums import AgentStatus
from app.models.agent import Agent
from app.schemas.agent import AgentRegister


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def register_agent(session: Session, reg: AgentRegister) -> tuple[Agent, bool]:
    """Create or update an agent on registration.

    Returns (agent, is_new) where is_new distinguishes a first registration from a
    reconnection (used to choose AGENT_REGISTERED vs AGENT_RECONNECTED ledger events).
    """
    agent = session.get(Agent, reg.agent_id)
    is_new = agent is None
    now = _utcnow()
    if agent is None:
        agent = Agent(
            id=reg.agent_id,
            hostname=reg.hostname,
            os=reg.os,
            username=reg.username,
            status=AgentStatus.ONLINE,
            health_score=100,
            first_seen=now,
            last_seen=now,
            registered_at=now,
        )
    else:
        agent.hostname = reg.hostname or agent.hostname
        agent.os = reg.os or agent.os
        agent.username = reg.username or agent.username
        agent.status = AgentStatus.ONLINE
        agent.health_score = 100
        agent.last_seen = now
        agent.registered_at = now
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent, is_new


def heartbeat(session: Session, agent_id: str) -> Agent | None:
    """Record a heartbeat: refresh last_seen and restore online status."""
    agent = session.get(Agent, agent_id)
    if agent is None:
        return None
    agent.last_seen = _utcnow()
    agent.status = AgentStatus.ONLINE
    agent.health_score = min(100, agent.health_score + 5)
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent


def mark_disconnected(session: Session, agent_id: str) -> Agent | None:
    agent = session.get(Agent, agent_id)
    if agent is None:
        return None
    agent.status = AgentStatus.OFFLINE
    agent.health_score = 0
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent


def reconcile_statuses(session: Session) -> list[Agent]:
    """Downgrade agents whose heartbeats have lapsed. Returns the changed agents."""
    now = _utcnow()
    changed: list[Agent] = []
    agents = session.exec(select(Agent)).all()
    for agent in agents:
        if agent.status == AgentStatus.OFFLINE:
            continue
        last_seen = agent.last_seen
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        elapsed = (now - last_seen).total_seconds()
        new_status = agent.status
        new_score = agent.health_score
        if elapsed >= settings.heartbeat_offline_seconds:
            new_status = AgentStatus.OFFLINE
            new_score = 0
        elif elapsed >= settings.heartbeat_warning_seconds:
            new_status = AgentStatus.WARNING
            new_score = max(40, agent.health_score - 30)
        if new_status != agent.status or new_score != agent.health_score:
            agent.status = new_status
            agent.health_score = new_score
            session.add(agent)
            changed.append(agent)
    if changed:
        session.commit()
        for agent in changed:
            session.refresh(agent)
    return changed


def list_agents(session: Session) -> list[Agent]:
    return list(session.exec(select(Agent).order_by(Agent.id)).all())


def get_agent(session: Session, agent_id: str) -> Agent | None:
    return session.get(Agent, agent_id)
