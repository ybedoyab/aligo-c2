"""Result persistence with node signature verification."""

from __future__ import annotations

import uuid
from typing import Any

from sqlmodel import Session, select

from app.core.enums import SignatureStatus, TaskStatus
from app.core.signing import build_signable_result_payload, verify_result_signature
from app.models.node import Node
from app.models.result import Result
from app.schemas.result import ResultIn
from app.services import task_service


class ResultRejected(Exception):
    """Raised when a result fails signature verification."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def _resolve_signature(
    session: Session, payload: ResultIn
) -> tuple[str, str]:
    node = session.get(Node, payload.node_id)
    signable = build_signable_result_payload(
        task_id=payload.task_id,
        mission_id=payload.mission_id,
        node_id=payload.node_id,
        status=str(payload.status),
        stdout=payload.stdout,
        stderr=payload.stderr,
        exit_code=payload.exit_code,
        duration_ms=payload.duration_ms,
        timestamp=payload.timestamp or "",
    )

    if not payload.node_signature:
        if node and node.public_key:
            return "", SignatureStatus.MISSING
        return "", SignatureStatus.MISSING

    if not node or not node.public_key:
        return payload.node_signature, SignatureStatus.INVALID

    ok = verify_result_signature(node.public_key, signable, payload.node_signature)
    return payload.node_signature, (
        SignatureStatus.VALID if ok else SignatureStatus.INVALID
    )


def save_result(session: Session, payload: ResultIn) -> Result:
    """Persist a result after verifying the node signature when a public key is registered."""
    node = session.get(Node, payload.node_id)
    signature, sig_status = _resolve_signature(session, payload)

    if node and node.public_key and sig_status != SignatureStatus.VALID:
        raise ResultRejected(
            f"result signature {sig_status} for node {payload.node_id}"
        )

    result = Result(
        id=f"res-{uuid.uuid4().hex[:12]}",
        task_id=payload.task_id,
        mission_id=payload.mission_id,
        node_id=payload.node_id,
        status=payload.status,
        stdout=payload.stdout,
        stderr=payload.stderr,
        exit_code=payload.exit_code,
        duration_ms=payload.duration_ms,
        result_metadata=payload.metadata,
        node_signature=signature,
        signature_status=str(sig_status),
    )
    session.add(result)
    session.commit()
    session.refresh(result)

    task = task_service.get_task(session, payload.task_id)
    if task is not None:
        task_service.set_status(session, task.id, payload.status)

    return result


def list_results(
    session: Session, mission_id: str | None = None, limit: int = 200
) -> list[Result]:
    statement = select(Result).order_by(Result.created_at.desc()).limit(limit)
    if mission_id:
        statement = (
            select(Result)
            .where(Result.mission_id == mission_id)
            .order_by(Result.created_at.desc())
            .limit(limit)
        )
    return list(session.exec(statement).all())


def get_result_for_task(session: Session, task_id: str) -> Result | None:
    return session.exec(
        select(Result).where(Result.task_id == task_id)
    ).first()
