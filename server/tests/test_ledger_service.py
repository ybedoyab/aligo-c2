"""Tests for the Proof-of-Execution Ledger service: chaining + verification."""

from __future__ import annotations

from sqlmodel import Session

from app.core.enums import EventType
from app.core.hashing import GENESIS_HASH
from app.services import ledger_service


def test_first_event_uses_genesis_previous_hash(session: Session):
    event = ledger_service.record_event(
        session, event_type=EventType.AGENT_REGISTERED, agent_id="agent-001"
    )
    assert event.sequence == 0
    assert event.previous_hash == GENESIS_HASH
    assert len(event.payload_hash) == 64


def test_events_chain_previous_hash(session: Session):
    first = ledger_service.record_event(
        session, event_type=EventType.MISSION_CREATED, mission_id="m1"
    )
    second = ledger_service.record_event(
        session, event_type=EventType.MISSION_STARTED, mission_id="m1"
    )
    assert second.sequence == first.sequence + 1
    assert second.previous_hash == first.payload_hash


def test_verify_reports_consistent_event_as_pending_chain(session: Session):
    event = ledger_service.record_event(
        session, event_type=EventType.TASK_RESULT, task_id="t1", agent_id="agent-001"
    )
    result = ledger_service.verify_event(session, event.id)
    assert result is not None
    assert result.local_match is True
    # Ledger disabled in tests -> not anchored -> pending_chain but locally verified.
    assert result.status == "pending_chain"
    assert result.verified is True


def test_verify_detects_tampering(session: Session):
    event = ledger_service.record_event(
        session,
        event_type=EventType.TASK_RESULT,
        task_id="t1",
        data={"exit_code": 0},
    )
    # Tamper with the stored payload without updating the stored hash.
    stored = ledger_service.get_event(session, event.id)
    assert stored is not None
    mutated = dict(stored.payload)
    mutated["data"] = {"exit_code": 999}
    stored.payload = mutated
    session.add(stored)
    session.commit()

    result = ledger_service.verify_event(session, event.id)
    assert result is not None
    assert result.local_match is False
    assert result.status == "tampered"
    assert result.verified is False
