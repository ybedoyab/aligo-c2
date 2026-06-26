"""Mission Merkle root computation and anchoring."""

from __future__ import annotations

import logging
from typing import Any

from sqlmodel import Session

from app.core.enums import EventType, OnChainStatus, TaskStatus
from app.core.merkle import build_merkle_tree, task_evidence_leaf, verify_merkle_proof
from app.core.enums import MerkleProofStatus
from app.models.mission import Mission
from app.services import ledger_service, result_service, task_service

logger = logging.getLogger("aligo.merkle")


def compute_task_evidence_hash(session: Session, task_id: str) -> str | None:
    """Hash of ledger primary event for a task (evidence anchor)."""
    event = ledger_service.get_primary_result_event(session, task_id)
    if event is None:
        return None
    return event.payload_hash


def merkle_proof_status(
    session: Session, task_id: str, mission: Mission | None
) -> MerkleProofStatus:
    if mission is None or not mission.merkle_root:
        return MerkleProofStatus.NOT_APPLICABLE
    task = task_service.get_task(session, task_id)
    if task is None or not task.evidence_hash or not task.merkle_proof:
        return MerkleProofStatus.PENDING
    leaf = task_evidence_leaf(
        task_id=task.id,
        node_id=task.node_id,
        plugin=task.plugin,
        evidence_hash=task.evidence_hash,
    )
    ok = verify_merkle_proof(leaf, task.merkle_proof, mission.merkle_root)
    return MerkleProofStatus.VALID if ok else MerkleProofStatus.INVALID


def finalize_mission_merkle(session: Session, mission_id: str) -> dict[str, Any] | None:
    """Compute mission Merkle root, proofs, and anchor on mission completion."""
    mission = session.get(Mission, mission_id)
    if mission is None:
        return None

    tasks = [
        t
        for t in task_service.list_tasks_for_mission(session, mission_id)
        if t.status == TaskStatus.SUCCESS
    ]
    if not tasks:
        return None

    tasks.sort(key=lambda t: t.created_at)
    leaves: list[str] = []
    for task in tasks:
        ev_hash = task.evidence_hash or compute_task_evidence_hash(session, task.id)
        if not ev_hash:
            continue
        task.evidence_hash = ev_hash
        leaves.append(
            task_evidence_leaf(
                task_id=task.id,
                node_id=task.node_id,
                plugin=task.plugin,
                evidence_hash=ev_hash,
            )
        )

    if not leaves:
        return None

    root, proofs = build_merkle_tree(leaves)
    leaf_index = 0
    for task in tasks:
        if not task.evidence_hash:
            continue
        task.merkle_proof = proofs.get(leaf_index, [])
        session.add(task)
        leaf_index += 1

    mission.merkle_root = root
    mission.merkle_root_status = "pending_chain"
    session.add(mission)
    session.commit()

    event = ledger_service.record_event(
        session,
        event_type=EventType.MISSION_MERKLE_ROOT,
        mission_id=mission_id,
        data={
            "merkle_root": root,
            "task_count": len(leaves),
            "leaf_hashes": leaves,
        },
    )
    if event.onchain_status in {OnChainStatus.ANCHORED, OnChainStatus.CONFIRMED}:
        mission.merkle_root_tx = event.tx_hash
        mission.merkle_root_block = event.block_number
        mission.merkle_root_status = "anchored"
    else:
        mission.merkle_root_tx = event.tx_hash
        mission.merkle_root_block = event.block_number
        mission.merkle_root_status = str(event.onchain_status)

    session.add(mission)
    session.commit()
    session.refresh(mission)

    logger.info("Mission %s merkle root %s (%d leaves)", mission_id, root[:16], len(leaves))
    return {
        "mission_id": mission_id,
        "merkle_root": root,
        "task_count": len(leaves),
        "ledger_event_id": event.id,
    }
