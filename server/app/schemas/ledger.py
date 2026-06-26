"""Pydantic schemas for ledger events and verification."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.core.enums import ChainStatus, EventType, OnChainStatus


class LedgerEventRead(BaseModel):
    id: str
    sequence: int | None
    mission_id: str
    task_id: str
    node_id: str
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
    local_match: bool
    chain_match: bool | None
    verified: bool
    status: str
    detail: str


class ChainStatusRead(BaseModel):
    status: ChainStatus
    ledger_enabled: bool
    contract_address: str | None
    rpc_url: str
    client_available: bool
    detail: str


class LedgerStats(BaseModel):
    total_events: int
    anchored_on_chain: int
    pending_chain: int
    verified: int
    tampered: int
    chain: ChainStatusRead


class AnchorResult(BaseModel):
    event_id: str
    success: bool
    onchain_status: OnChainStatus | None = None
    tx_hash: str | None = None
    block_number: int | None = None
    detail: str
