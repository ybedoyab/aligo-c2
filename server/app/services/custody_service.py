"""Chain of custody timeline for task execution evidence."""

from __future__ import annotations

from typing import Any

from sqlmodel import Session

from app.core.enums import EventType, IntegrityStatus, SignatureStatus
from app.models.ledger_event import LedgerEvent
from app.models.mission import Mission
from app.models.node import Node
from app.models.result import Result
from app.models.task import Task
from app.services import ledger_service


def _step(
    step: int,
    label: str,
    *,
    timestamp: str | None = None,
    status: str = "pending",
    detail: str = "",
) -> dict[str, Any]:
    return {
        "step": step,
        "label": label,
        "timestamp": timestamp,
        "status": status,
        "detail": detail,
    }


def build_chain_of_custody(
    session: Session,
    *,
    task: Task,
    result: Result | None,
    node: Node | None,
    mission: Mission | None,
    primary_event: LedgerEvent | None,
) -> list[dict[str, Any]]:
    events = ledger_service.get_events_for_task(session, task.id)
    policy = task.policy_decision or {}
    policy_status = "completed" if policy else "pending"
    if task.status.value == "blocked_by_policy":
        policy_status = "blocked"

    chain = [
        _step(
            1,
            "Task created",
            timestamp=task.created_at.isoformat() if task.created_at else None,
            status="completed",
            detail=f"plugin={task.plugin}",
        ),
        _step(
            2,
            "Policy evaluated",
            timestamp=policy.get("timestamp"),
            status=policy_status,
            detail=policy.get("reason", ""),
        ),
        _step(
            3,
            "Task dispatched",
            timestamp=task.sent_at.isoformat() if task.sent_at else None,
            status="completed" if task.sent_at else "skipped",
            detail="sent to node" if task.sent_at else "not dispatched",
        ),
    ]

    sig_status = result.signature_status if result else SignatureStatus.MISSING
    chain.append(
        _step(
            4,
            "Result signed by node",
            timestamp=result.created_at.isoformat() if result else None,
            status=str(sig_status),
            detail=f"fingerprint={node.fingerprint if node else '—'}",
        )
    )

    ev_hash = primary_event.payload_hash if primary_event else task.evidence_hash
    chain.append(
        _step(
            5,
            "Evidence hashed",
            timestamp=primary_event.timestamp if primary_event else None,
            status="completed" if ev_hash else "pending",
            detail=ev_hash[:16] + "…" if ev_hash else "",
        )
    )

    anchored = primary_event and primary_event.tx_hash
    chain.append(
        _step(
            6,
            "Hash anchored on-chain",
            timestamp=primary_event.timestamp if anchored else None,
            status=str(primary_event.onchain_status) if primary_event else "pending",
            detail=primary_event.tx_hash[:18] + "…" if anchored and primary_event.tx_hash else "",
        )
    )

    integrity = ledger_service.integrity_for_event(session, primary_event)
    chain.append(
        _step(
            7,
            "Evidence verified",
            status=str(integrity),
            detail="independent verification available",
        )
    )

    if mission and mission.merkle_root:
        chain.append(
            _step(
                8,
                "Mission Merkle root",
                status=mission.merkle_root_status or "pending",
                detail=mission.merkle_root[:16] + "…",
            )
        )

    return chain
