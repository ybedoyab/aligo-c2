"""Tests for the Proof-of-Execution Ledger service: chaining + verification."""

from __future__ import annotations

from sqlmodel import Session

from app.core.enums import EventType, OnChainStatus
from app.core.hashing import GENESIS_HASH
from app.services import ledger_service


def test_first_event_uses_genesis_previous_hash(session: Session):
    event = ledger_service.record_event(
        session, event_type=EventType.NODE_REGISTERED, node_id="node-001"
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
        session, event_type=EventType.TASK_RESULT, task_id="t1", node_id="node-001"
    )
    result = ledger_service.verify_event(session, event.id)
    assert result is not None
    assert result.local_match is True
    assert result.status == "pending_chain"
    assert result.verified is True


def test_reconcile_resets_stale_anchors(session: Session, monkeypatch):
    event = ledger_service.record_event(
        session, event_type=EventType.TASK_RESULT, task_id="t-stale", node_id="node-001"
    )
    event.onchain_status = OnChainStatus.ANCHORED
    event.tx_hash = "0xdeadbeef"
    event.block_number = 1
    session.add(event)
    session.commit()

    class _FakeClient:
        available = True

        def event_exists(self, _event_id: str) -> bool:
            return False

    monkeypatch.setattr(
        "app.services.ledger_service.get_contract_client", lambda: _FakeClient()
    )
    reset = ledger_service.reconcile_chain_anchors(session)
    assert reset == 1
    refreshed = ledger_service.get_event(session, event.id)
    assert refreshed is not None
    assert refreshed.onchain_status == OnChainStatus.PENDING_CHAIN
    assert refreshed.tx_hash is None


def test_ensure_chain_sync_noop_when_ledger_disabled(session: Session):
    summary = ledger_service.ensure_chain_sync(session)
    assert summary["stale_reset"] == 0
    assert summary["re_anchored"] == 0


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
