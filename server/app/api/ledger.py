"""Ledger REST endpoints: list events, fetch one, verify integrity, anchor on-chain."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.ledger import (
    AnchorResult,
    ChainStatusRead,
    LedgerEventRead,
    LedgerStats,
    LedgerVerifyResult,
)
from app.services import ledger_service

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@router.get("/status", response_model=ChainStatusRead)
def chain_status() -> ChainStatusRead:
    return ledger_service.get_chain_status()


@router.get("/stats", response_model=LedgerStats)
def ledger_stats(session: Session = Depends(get_session)) -> LedgerStats:
    return ledger_service.get_ledger_stats(session)


@router.get("/events", response_model=list[LedgerEventRead])
def list_events(session: Session = Depends(get_session)) -> list[LedgerEventRead]:
    return [
        LedgerEventRead.model_validate(e) for e in ledger_service.list_events(session)
    ]


@router.get("/events/{event_id}", response_model=LedgerEventRead)
def get_event(event_id: str, session: Session = Depends(get_session)) -> LedgerEventRead:
    event = ledger_service.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="ledger event not found")
    return LedgerEventRead.model_validate(event)


@router.post("/events/{event_id}/verify", response_model=LedgerVerifyResult)
def verify_event(
    event_id: str, session: Session = Depends(get_session)
) -> LedgerVerifyResult:
    result = ledger_service.verify_event(session, event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="ledger event not found")
    return result


@router.post("/events/{event_id}/anchor", response_model=AnchorResult)
def anchor_event(
    event_id: str, session: Session = Depends(get_session)
) -> AnchorResult:
    return ledger_service.anchor_event(session, event_id)


@router.post("/anchor-pending", response_model=list[AnchorResult])
def anchor_pending(session: Session = Depends(get_session)) -> list[AnchorResult]:
    return ledger_service.anchor_pending_events(session)
