"""Proof-of-Execution Ledger service: event chaining, anchoring, and verification."""

from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.blockchain.contract_client import get_contract_client
from app.core.config import settings
from app.core.enums import ChainStatus, EventType, IntegrityStatus, OnChainStatus
from app.core.hashing import GENESIS_HASH, hash_payload
from app.models.ledger_event import LedgerEvent
from app.schemas.ledger import AnchorResult, ChainStatusRead, LedgerStats, LedgerVerifyResult

logger = logging.getLogger("aligo.ledger")

# Serialize event creation so the previous_hash chain stays consistent under concurrency.
_chain_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _iso_to_unix(iso: str) -> int:
    try:
        cleaned = iso.replace("Z", "+00:00")
        return int(datetime.fromisoformat(cleaned).timestamp())
    except ValueError:
        return int(datetime.now(timezone.utc).timestamp())


def build_canonical_payload(
    *,
    event_id: str,
    sequence: int,
    event_type: str,
    mission_id: str,
    task_id: str,
    node_id: str,
    data: dict[str, Any],
    previous_hash: str,
    timestamp: str,
) -> dict[str, Any]:
    """Assemble the exact dict that gets canonicalized + hashed.

    Keeping this in one place guarantees the hash is reproducible during verification.
    """
    return {
        "event_id": event_id,
        "sequence": sequence,
        "event_type": event_type,
        "mission_id": mission_id,
        "task_id": task_id,
        "node_id": node_id,
        "data": data,
        "previous_hash": previous_hash,
        "timestamp": timestamp,
    }


def record_event(
    session: Session,
    *,
    event_type: EventType,
    mission_id: str = "",
    task_id: str = "",
    node_id: str = "",
    data: dict[str, Any] | None = None,
) -> LedgerEvent:
    """Create, hash, persist and (best-effort) anchor a new ledger event."""
    data = data or {}
    with _chain_lock:
        last = session.exec(
            select(LedgerEvent).order_by(LedgerEvent.sequence.desc())
        ).first()
        sequence = (last.sequence + 1) if last and last.sequence is not None else 0
        previous_hash = last.payload_hash if last else GENESIS_HASH

        event_id = f"evt-{sequence:06d}-{uuid.uuid4().hex[:8]}"
        timestamp = _now_iso()

        payload = build_canonical_payload(
            event_id=event_id,
            sequence=sequence,
            event_type=str(event_type),
            mission_id=mission_id,
            task_id=task_id,
            node_id=node_id,
            data=data,
            previous_hash=previous_hash,
            timestamp=timestamp,
        )
        payload_hash = hash_payload(payload)

        event = LedgerEvent(
            id=event_id,
            sequence=sequence,
            mission_id=mission_id,
            task_id=task_id,
            node_id=node_id,
            event_type=event_type,
            payload=payload,
            payload_hash=payload_hash,
            previous_hash=previous_hash,
            timestamp=timestamp,
            onchain_status=OnChainStatus.PENDING_CHAIN,
        )
        session.add(event)
        session.commit()
        session.refresh(event)

    # Best-effort on-chain anchoring (outside the lock; failures are non-fatal).
    client = get_contract_client()
    if not client.available:
        if "disabled" in client.reason:
            event.onchain_status = OnChainStatus.DISABLED
            session.add(event)
            session.commit()
            session.refresh(event)
        logger.debug("Skipping on-chain anchor for %s: %s", event_id, client.reason)
        return event

    anchor = client.register_event(
        event_id=event.id,
        mission_id=mission_id,
        task_id=task_id,
        node_id=node_id,
        event_type=str(event_type),
        payload_hash=payload_hash,
        previous_hash=previous_hash,
        timestamp_unix=_iso_to_unix(timestamp),
    )
    if anchor:
        event.tx_hash = anchor["tx_hash"]
        event.block_number = anchor["block_number"]
        event.onchain_status = OnChainStatus.ANCHORED
        session.add(event)
        session.commit()
        session.refresh(event)
        logger.info("Anchored %s on-chain (tx=%s)", event_id, anchor["tx_hash"])
    return event


def list_events(session: Session, limit: int = 200) -> list[LedgerEvent]:
    return list(
        session.exec(
            select(LedgerEvent).order_by(LedgerEvent.sequence.desc()).limit(limit)
        ).all()
    )


def get_event(session: Session, event_id: str) -> LedgerEvent | None:
    return session.get(LedgerEvent, event_id)


def verify_event(session: Session, event_id: str) -> LedgerVerifyResult | None:
    """Recompute the local hash and compare with stored + on-chain hashes."""
    event = session.get(LedgerEvent, event_id)
    if not event:
        return None

    recomputed = hash_payload(event.payload)
    local_match = recomputed == event.payload_hash

    client = get_contract_client()
    onchain_hash = client.get_onchain_hash(event_id) if client.available else None

    chain_match: bool | None = None
    if onchain_hash is not None:
        normalized = onchain_hash[2:] if onchain_hash.startswith("0x") else onchain_hash
        chain_match = normalized.lower() == event.payload_hash.lower()

    if not local_match:
        status, verified, detail = (
            "tampered",
            False,
            "Recomputed hash does not match the stored local hash.",
        )
    elif chain_match is None:
        status, verified, detail = (
            "pending_chain",
            local_match,
            "Event is not anchored on-chain; local hash is consistent.",
        )
    elif chain_match:
        status, verified, detail = (
            "verified",
            True,
            "Local and on-chain hashes match. Integrity confirmed.",
        )
    else:
        status, verified, detail = (
            "tampered",
            False,
            "Stored hash does not match the on-chain hash.",
        )

    return LedgerVerifyResult(
        event_id=event_id,
        local_hash=event.payload_hash,
        recomputed_hash=recomputed,
        onchain_hash=onchain_hash,
        local_match=local_match,
        chain_match=chain_match,
        verified=verified,
        status=status,
        detail=detail,
    )


def count_events(session: Session) -> int:
    return len(list(session.exec(select(LedgerEvent.id)).all()))


def _is_anchored(status: OnChainStatus) -> bool:
    return status in {OnChainStatus.ANCHORED, OnChainStatus.CONFIRMED}


def get_events_for_task(session: Session, task_id: str) -> list[LedgerEvent]:
    return list(
        session.exec(
            select(LedgerEvent)
            .where(LedgerEvent.task_id == task_id)
            .order_by(LedgerEvent.sequence.asc())
        ).all()
    )


def get_primary_result_event(session: Session, task_id: str) -> LedgerEvent | None:
    """Prefer TASK_RESULT, then TASK_FAILED, then TASK_SENT for a task."""
    events = get_events_for_task(session, task_id)
    for preferred in (EventType.TASK_RESULT, EventType.TASK_FAILED, EventType.TASK_SENT):
        for e in events:
            if e.event_type == preferred:
                return e
    return events[-1] if events else None


def integrity_for_event(session: Session, event: LedgerEvent | None) -> IntegrityStatus:
    if event is None:
        return IntegrityStatus.UNKNOWN
    if event.onchain_status == OnChainStatus.DISABLED:
        return IntegrityStatus.LOCAL_ONLY
    if not _is_anchored(event.onchain_status):
        return IntegrityStatus.PENDING_CHAIN
    result = verify_event(session, event.id)
    if result is None:
        return IntegrityStatus.UNKNOWN
    if result.status == "verified":
        return IntegrityStatus.VERIFIED
    if result.status == "tampered":
        return IntegrityStatus.TAMPERED
    return IntegrityStatus.PENDING_CHAIN


def get_chain_status() -> ChainStatusRead:
    client = get_contract_client()
    address = settings.resolved_contract_address()

    if not settings.ledger_enabled:
        status = ChainStatus.LOCAL_ONLY
        detail = "Ledger disabled (LEDGER_ENABLED=false)."
    elif not address:
        status = ChainStatus.CONTRACT_NOT_CONFIGURED
        detail = "Set CONTRACT_ADDRESS in .env or run deploy-contract."
    elif not client.available:
        if "cannot reach" in client.reason or "initialization" in client.reason:
            status = ChainStatus.DISCONNECTED
        else:
            status = ChainStatus.CONTRACT_NOT_CONFIGURED
        detail = client.reason
    else:
        status = ChainStatus.CONNECTED
        detail = f"Connected to ExecutionLedger at {address}"

    return ChainStatusRead(
        status=status,
        ledger_enabled=settings.ledger_enabled,
        contract_address=address or None,
        rpc_url=settings.blockchain_rpc_url,
        client_available=client.available,
        detail=detail,
    )


def get_ledger_stats(session: Session) -> LedgerStats:
    events = list(session.exec(select(LedgerEvent)).all())
    anchored = sum(1 for e in events if _is_anchored(e.onchain_status))
    pending = sum(1 for e in events if e.onchain_status == OnChainStatus.PENDING_CHAIN)
    verified = tampered = 0
    for e in events:
        if e.event_type not in {
            EventType.TASK_RESULT,
            EventType.TASK_FAILED,
            EventType.TASK_SENT,
        }:
            continue
        iv = integrity_for_event(session, e)
        if iv == IntegrityStatus.VERIFIED:
            verified += 1
        elif iv == IntegrityStatus.TAMPERED:
            tampered += 1
    chain = get_chain_status()
    return LedgerStats(
        total_events=len(events),
        anchored_on_chain=anchored,
        pending_chain=pending,
        verified=verified,
        tampered=tampered,
        chain=chain,
    )


def anchor_event(session: Session, event_id: str) -> AnchorResult:
    event = session.get(LedgerEvent, event_id)
    if event is None:
        return AnchorResult(
            event_id=event_id,
            success=False,
            detail="ledger event not found",
        )
    if _is_anchored(event.onchain_status):
        return AnchorResult(
            event_id=event_id,
            success=True,
            onchain_status=event.onchain_status,
            tx_hash=event.tx_hash,
            block_number=event.block_number,
            detail="already anchored on-chain",
        )
    if event.onchain_status == OnChainStatus.DISABLED:
        return AnchorResult(
            event_id=event_id,
            success=False,
            detail="ledger is disabled",
        )

    client = get_contract_client()
    if not client.available:
        return AnchorResult(
            event_id=event_id,
            success=False,
            detail=client.reason,
        )

    anchor = client.register_event(
        event_id=event.id,
        mission_id=event.mission_id,
        task_id=event.task_id,
        node_id=event.node_id,
        event_type=str(event.event_type),
        payload_hash=event.payload_hash,
        previous_hash=event.previous_hash,
        timestamp_unix=_iso_to_unix(event.timestamp),
    )
    if not anchor:
        return AnchorResult(
            event_id=event_id,
            success=False,
            detail="on-chain registration failed",
        )

    event.tx_hash = anchor["tx_hash"]
    event.block_number = anchor["block_number"]
    event.onchain_status = OnChainStatus.ANCHORED
    session.add(event)
    session.commit()
    session.refresh(event)
    logger.info("Manually anchored %s (tx=%s)", event_id, anchor["tx_hash"])
    return AnchorResult(
        event_id=event_id,
        success=True,
        onchain_status=event.onchain_status,
        tx_hash=event.tx_hash,
        block_number=event.block_number,
        detail="anchored on-chain",
    )


def anchor_pending_events(session: Session, limit: int = 50) -> list[AnchorResult]:
    pending = list(
        session.exec(
            select(LedgerEvent)
            .where(LedgerEvent.onchain_status == OnChainStatus.PENDING_CHAIN)
            .order_by(LedgerEvent.sequence.asc())
            .limit(limit)
        ).all()
    )
    return [anchor_event(session, e.id) for e in pending]
