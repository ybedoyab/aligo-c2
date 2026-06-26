"""Build task evidence and node detail views by joining tasks, results, and ledger."""

from __future__ import annotations

from sqlmodel import Session

from app.core.enums import IntegrityStatus, TaskStatus
from app.core.signing import build_signable_result_payload
from app.models.mission import Mission
from app.models.node import Node
from app.schemas.node import (
    NodeDetailRead,
    NodeRead,
    NodeStats,
    NodeTaskHistoryRow,
)
from app.schemas.task import CustodyStepRead, EvidenceBundleRead, TaskEvidenceRead
from app.services import (
    custody_service,
    iot_service,
    ledger_service,
    merkle_service,
    node_service,
    result_service,
    task_service,
    verifier_service,
)


def build_task_evidence(session: Session, task_id: str) -> TaskEvidenceRead | None:
    bundle = build_evidence_bundle(session, task_id)
    if bundle is None:
        return None
    return TaskEvidenceRead(**bundle.model_dump())


def build_evidence_bundle(session: Session, task_id: str) -> EvidenceBundleRead | None:
    task = task_service.get_task(session, task_id)
    if task is None:
        return None

    result = result_service.get_result_for_task(session, task_id)
    ledger_event = ledger_service.get_primary_result_event(session, task_id)
    mission = session.get(Mission, task.mission_id)
    node = session.get(Node, task.node_id)
    integrity = ledger_service.integrity_for_event(session, ledger_event)
    merkle_status = merkle_service.merkle_proof_status(session, task_id, mission)

    signed_payload = None
    if result:
        signed_payload = build_signable_result_payload(
            task_id=task.id,
            mission_id=task.mission_id,
            node_id=task.node_id,
            status=str(result.status),
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.exit_code,
            duration_ms=result.duration_ms,
            timestamp=result.created_at.isoformat(),
        )

    custody = custody_service.build_chain_of_custody(
        session,
        task=task,
        result=result,
        node=node,
        mission=mission,
        primary_event=ledger_event,
    )

    base = TaskEvidenceRead(
        task_id=task.id,
        node_id=task.node_id,
        mission_id=task.mission_id,
        mission_name=mission.name if mission else None,
        plugin=task.plugin,
        args=task.args,
        status=task.status,
        stdout=result.stdout if result else "",
        stderr=result.stderr if result else "",
        exit_code=result.exit_code if result else None,
        duration_ms=result.duration_ms if result else None,
        created_at=task.created_at,
        sent_at=task.sent_at,
        completed_at=task.completed_at,
        local_hash=ledger_event.payload_hash if ledger_event else None,
        previous_hash=ledger_event.previous_hash if ledger_event else None,
        ledger_event_id=ledger_event.id if ledger_event else None,
        blockchain_tx_hash=ledger_event.tx_hash if ledger_event else None,
        block_number=ledger_event.block_number if ledger_event else None,
        on_chain_status=ledger_event.onchain_status if ledger_event else None,
        integrity_status=integrity,
        result_id=result.id if result else None,
        node_fingerprint=node.fingerprint if node else None,
        node_public_key=node.public_key if node else None,
        node_signature=result.node_signature if result else None,
        signature_status=result.signature_status if result else "missing",
        policy_decision=task.policy_decision,
        evidence_hash=task.evidence_hash or (
            ledger_event.payload_hash if ledger_event else None
        ),
        mission_merkle_root=mission.merkle_root if mission else None,
        merkle_proof=task.merkle_proof,
        merkle_proof_status=str(merkle_status),
        chain_of_custody=[CustodyStepRead(**s) for s in custody],
        anchored_snapshot=ledger_event.anchored_snapshot if ledger_event else None,
        **iot_service.build_iot_evidence_extras(task=task, node=node, result=result),
    )

    bundle_dict = base.model_dump()
    bundle_dict["ledger_payload"] = ledger_event.payload if ledger_event else None
    bundle_dict["result_timestamp"] = result.created_at.isoformat() if result else None
    bundle_dict["signed_payload"] = signed_payload
    bundle_dict["verification_summary"] = verifier_service.verify_evidence_bundle(
        bundle_dict
    ).get("summary", {})

    return EvidenceBundleRead(**bundle_dict)


def _task_history_row(session: Session, task) -> NodeTaskHistoryRow:
    result = result_service.get_result_for_task(session, task.id)
    ledger_event = ledger_service.get_primary_result_event(session, task.id)
    return NodeTaskHistoryRow(
        task_id=task.id,
        mission_id=task.mission_id,
        plugin=task.plugin,
        args=task.args,
        status=task.status,
        duration_ms=result.duration_ms if result else None,
        exit_code=result.exit_code if result else None,
        created_at=task.created_at,
        completed_at=task.completed_at,
        ledger_event_id=ledger_event.id if ledger_event else None,
        integrity_status=ledger_service.integrity_for_event(session, ledger_event),
    )


def get_node_detail(session: Session, node_id: str) -> NodeDetailRead | None:
    node = node_service.get_node(session, node_id)
    if node is None:
        return None

    tasks = task_service.list_tasks_for_node(session, node_id)
    success = sum(1 for t in tasks if t.status == TaskStatus.SUCCESS)
    failed = sum(
        1
        for t in tasks
        if t.status in {TaskStatus.FAILED, TaskStatus.TIMEOUT}
    )

    return NodeDetailRead(
        node=NodeRead.model_validate(node),
        stats=NodeStats(
            total_tasks=len(tasks),
            successful_tasks=success,
            failed_tasks=failed,
        ),
        last_heartbeat=node.last_seen,
        health=node_service.explain_health(session, node),
        tasks=[_task_history_row(session, t) for t in tasks],
    )
