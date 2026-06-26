"""Pydantic schemas for ledger events and verification."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.core.enums import EventType, OnChainStatus


class LedgerEventRead(BaseModel):
    id: str
    sequence: int | None
    mission_id: str
    task_id: str
    agent_id: str
    event_type: EventType
    payload: dict[str, Any]
    payload_hash: str
    previous_hash: str
    timestamp: str
    onchain_status: OnChainStatus
    tx_hash: str | None
    block_number: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LedgerVerifyResult(BaseModel):
    event_id: str
    local_hash: str
    recomputed_hash: str
    onchain_hash: str | None
    local_match: bool          # recomputed == stored local hash
    chain_match: bool | None   # stored hash == on-chain hash (None if not anchored)
    verified: bool             # overall integrity verdict
    status: str                # "verified" | "tampered" | "pending_chain"
    detail: str
