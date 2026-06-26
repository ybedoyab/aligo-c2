"""Build task evidence and node detail views by joining tasks, results, and ledger."""

from __future__ import annotations

from sqlmodel import Session

from app.core.enums import IntegrityStatus, TaskStatus
from app.models.mission import Mission
from app.schemas.node import (
    NodeDetailRead,
    NodeRead,
    NodeStats,
    NodeTaskHistoryRow,
)
from app.schemas.task import TaskEvidenceRead
from app.services import node_service, ledger_service, result_service, task_service


def build_task_evidence(session: Session, task_id: str) -> TaskEvidenceRead | None:
    task = task_service.get_task(session, task_id)
    if task is None:
        return None

    result = result_service.get_result_for_task(session, task_id)
    ledger_event = ledger_service.get_primary_result_event(session, task_id)
    mission = session.get(Mission, task.mission_id)
    integrity = ledger_service.integrity_for_event(session, ledger_event)

    return TaskEvidenceRead(
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
    )


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
