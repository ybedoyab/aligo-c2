"""Proof-of-Execution Ledger service: event chaining, anchoring, and verification."""

from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.blockchain.contract_client import get_contract_client
from app.core.enums import EventType, OnChainStatus
from app.core.hashing import GENESIS_HASH, hash_payload
from app.models.ledger_event import LedgerEvent
from app.schemas.ledger import LedgerVerifyResult

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
    agent_id: str,
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
        "agent_id": agent_id,
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
    agent_id: str = "",
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
            agent_id=agent_id,
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
            agent_id=agent_id,
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
        agent_id=agent_id,
        event_type=str(event_type),
        payload_hash=payload_hash,
        previous_hash=previous_hash,
        timestamp_unix=_iso_to_unix(timestamp),
    )
    if anchor:
        event.tx_hash = anchor["tx_hash"]
        event.block_number = anchor["block_number"]
        event.onchain_status = OnChainStatus.CONFIRMED
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
