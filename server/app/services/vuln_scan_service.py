"""Orchestrate vulnerability scans: recon mission, facts, OSINT, issues."""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.core.enums import MissionStatus, TaskStatus, VulnScanStatus, VulnScanTrigger
from app.db.database import engine
from app.models.vulnerability_scan import VulnerabilityScan
from app.models.vulnerability_issue import VulnerabilityIssue
from app.schemas.mission import MissionCreate, MissionStep
from app.services import mission_service, result_service, task_service
from app.services.vuln_analysis_service import analyze_node, optional_llm_summary
from app.services.vuln_osint_service import fetch_cisa_kev
from app.websocket import dispatch, notifier
from app.websocket.manager import manager

logger = logging.getLogger("aligo.vuln.scan")

VULN_RECON_MISSION_ID = "mission-vuln-recon"
VULN_RECON_STEPS = [
    {"plugin": "health_check", "args": {}},
    {"plugin": "system_info", "args": {}},
    {"plugin": "network_info", "args": {}},
    {"plugin": "list_lab_directory", "args": {"path": "."}},
]

_TERMINAL_TASK = {
    TaskStatus.SUCCESS,
    TaskStatus.FAILED,
    TaskStatus.TIMEOUT,
    TaskStatus.BLOCKED_BY_POLICY,
}

_scan_lock = asyncio.Lock()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def list_scans(session: Session, limit: int = 50) -> list[VulnerabilityScan]:
    return list(
        session.exec(
            select(VulnerabilityScan).order_by(VulnerabilityScan.created_at.desc()).limit(limit)
        ).all()
    )


def get_scan(session: Session, scan_id: str) -> VulnerabilityScan | None:
    return session.get(VulnerabilityScan, scan_id)


def get_running_scan(session: Session) -> VulnerabilityScan | None:
    row = session.exec(
        select(VulnerabilityScan).where(VulnerabilityScan.status == VulnScanStatus.RUNNING)
    ).first()
    return row


def list_issues(
    session: Session,
    *,
    scan_id: str | None = None,
    node_id: str | None = None,
    severity: str | None = None,
    limit: int = 200,
) -> list[VulnerabilityIssue]:
    statement = select(VulnerabilityIssue).order_by(VulnerabilityIssue.created_at.desc())
    if scan_id:
        statement = statement.where(VulnerabilityIssue.scan_id == scan_id)
    if node_id:
        statement = statement.where(VulnerabilityIssue.node_id == node_id)
    if severity:
        statement = statement.where(VulnerabilityIssue.severity == severity)
    statement = statement.limit(limit)
    return list(session.exec(statement).all())


def extract_facts(session: Session, mission_id: str) -> dict[str, dict[str, Any]]:
    """Parse successful task stdout JSON into per-node facts."""
    facts_by_node: dict[str, dict[str, Any]] = {}
    tasks = task_service.list_tasks_for_mission(session, mission_id)

    for task in tasks:
        if task.status != TaskStatus.SUCCESS:
            continue
        result = result_service.get_result_for_task(session, task.id)
        if result is None or not result.stdout:
            continue
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue

        node_facts = facts_by_node.setdefault(
            task.node_id,
            {"node_id": task.node_id},
        )
        node_facts[task.plugin] = data

    return facts_by_node


def _resolve_targets(session: Session, node_ids: list[str]) -> list[str]:
    if node_ids:
        return node_ids
    connected = manager.connected_node_ids()
    if connected:
        return connected
    from app.services import node_service

    nodes = node_service.list_nodes(session)
    return [n.id for n in nodes if n.status.value == "online"]


def create_scan_record(
    session: Session,
    trigger: VulnScanTrigger,
    node_ids: list[str],
) -> VulnerabilityScan:
    scan = VulnerabilityScan(
        id=f"scan-{uuid.uuid4().hex[:12]}",
        status=VulnScanStatus.PENDING,
        trigger=trigger,
        node_ids=node_ids,
    )
    session.add(scan)
    session.commit()
    session.refresh(scan)
    return scan


async def _wait_for_mission(mission_id: str, timeout: float = 120.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with Session(engine) as session:
            tasks = task_service.list_tasks_for_mission(session, mission_id)
            if tasks and all(t.status in _TERMINAL_TASK for t in tasks):
                mission_service.recompute_status(session, mission_id)
                return
        await asyncio.sleep(2)
    logger.warning("Mission %s did not complete within timeout", mission_id)


async def _execute_scan(scan_id: str) -> None:
    async with _scan_lock:
        with Session(engine) as session:
            scan = get_scan(session, scan_id)
            if scan is None:
                return
            scan.status = VulnScanStatus.RUNNING
            scan.started_at = _utcnow()
            session.add(scan)
            session.commit()

        try:
            with Session(engine) as session:
                scan = get_scan(session, scan_id)
                if scan is None:
                    return
                targets = _resolve_targets(session, scan.node_ids)
                if not targets:
                    scan.status = VulnScanStatus.FAILED
                    scan.error_message = "no target nodes online or specified"
                    scan.finished_at = _utcnow()
                    session.add(scan)
                    session.commit()
                    await _broadcast_scan(scan)
                    return

                scan.node_ids = targets
                session.add(scan)
                session.commit()

                steps = [MissionStep(plugin=s["plugin"], args=s.get("args", {})) for s in VULN_RECON_STEPS]
                mission = mission_service.create_mission(
                    session,
                    MissionCreate(
                        name=f"Vuln Recon {scan_id}",
                        description="Automated vulnerability scan recon (lab-safe plugins)",
                        steps=steps,
                        target_node_ids=targets,
                    ),
                )
                mission, tasks = mission_service.start_mission(session, mission.id, targets)
                mission_id = mission.id
                task_ids = [t.id for t in tasks]
                scan.mission_id = mission_id
                session.add(scan)
                session.commit()

            await dispatch.dispatch_tasks(task_ids)
            await _wait_for_mission(mission_id)

            all_issues: list[VulnerabilityIssue] = []
            with Session(engine) as session:
                scan = get_scan(session, scan_id)
                if scan is None or not scan.mission_id:
                    return
                facts = extract_facts(session, scan.mission_id)
                scan.facts = facts
                session.add(scan)
                session.commit()

                kev_cves = await fetch_cisa_kev()

                for node_id, node_facts in facts.items():
                    node_issues = await analyze_node(
                        session, scan_id, node_id, node_facts, kev_cves
                    )
                    all_issues.extend(node_issues)
                    for issue in node_issues:
                        from app.schemas.vulnerability import VulnerabilityIssueRead

                        await notifier.broadcast(
                            {
                                "type": "vulnerability_issue",
                                "data": VulnerabilityIssueRead.model_validate(issue).model_dump(
                                    mode="json"
                                ),
                            }
                        )

                summary = await optional_llm_summary(facts, all_issues)
                scan = get_scan(session, scan_id)
                if scan:
                    scan.summary = summary
                    scan.issue_count = len(all_issues)
                    scan.status = VulnScanStatus.COMPLETED
                    scan.finished_at = _utcnow()
                    session.add(scan)
                    session.commit()
                    await _broadcast_scan(scan)

        except Exception as exc:
            logger.exception("Vulnerability scan %s failed: %s", scan_id, exc)
            with Session(engine) as session:
                scan = get_scan(session, scan_id)
                if scan:
                    scan.status = VulnScanStatus.FAILED
                    scan.error_message = str(exc)[:500]
                    scan.finished_at = _utcnow()
                    session.add(scan)
                    session.commit()
                    await _broadcast_scan(scan)


async def _broadcast_scan(scan: VulnerabilityScan) -> None:
    from app.schemas.vulnerability import VulnerabilityScanRead

    await notifier.broadcast(
        {
            "type": "vulnerability_scan_update",
            "data": VulnerabilityScanRead.model_validate(scan).model_dump(mode="json"),
        }
    )


async def trigger_scan(
    trigger: VulnScanTrigger,
    node_ids: list[str] | None = None,
) -> VulnerabilityScan:
    with Session(engine) as session:
        running = get_running_scan(session)
        if running:
            raise ValueError("a vulnerability scan is already running")

        targets = node_ids or []
        scan = create_scan_record(session, trigger, targets)

    asyncio.create_task(_execute_scan(scan.id))
    return scan


def ensure_vuln_recon_mission(session: Session) -> None:
    """Ensure predefined vuln recon template exists (used as reference in seed)."""
    existing = mission_service.get_mission(session, VULN_RECON_MISSION_ID)
    if existing:
        return
    from app.models.mission import Mission

    mission = Mission(
        id=VULN_RECON_MISSION_ID,
        name="Vulnerability Recon",
        description="Lab-safe recon for vulnerability scanning: health, system, network, directory.",
        status=MissionStatus.DRAFT,
        steps=VULN_RECON_STEPS,
        target_node_ids=[],
        is_predefined=True,
    )
    session.add(mission)
    session.commit()
