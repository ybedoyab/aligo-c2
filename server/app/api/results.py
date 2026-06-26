"""Result REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.result import ResultRead
from app.services import result_service

router = APIRouter(prefix="/api/results", tags=["results"])


@router.get("", response_model=list[ResultRead])
def list_results(
    mission_id: str | None = None, session: Session = Depends(get_session)
) -> list[ResultRead]:
    return [
        ResultRead.model_validate(r)
        for r in result_service.list_results(session, mission_id)
    ]
