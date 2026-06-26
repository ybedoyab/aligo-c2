"""Agent REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.agent import AgentRead
from app.services import agent_service
from app.websocket.manager import manager

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[AgentRead])
def list_agents(session: Session = Depends(get_session)) -> list[AgentRead]:
    agents = agent_service.list_agents(session)
    return [AgentRead.model_validate(a) for a in agents]


@router.get("/{agent_id}", response_model=AgentRead)
def get_agent(agent_id: str, session: Session = Depends(get_session)) -> AgentRead:
    agent = agent_service.get_agent(session, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return AgentRead.model_validate(agent)


@router.get("/{agent_id}/connected")
def agent_connected(agent_id: str) -> dict:
    return {"agent_id": agent_id, "connected": manager.is_agent_connected(agent_id)}
