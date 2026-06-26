"""Node policy REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.node import PolicyRead
from app.services import policy_service

router = APIRouter(prefix="/api/policies", tags=["policies"])


@router.get("", response_model=list[PolicyRead])
def list_policies() -> list[PolicyRead]:
    return policy_service.list_policies()
