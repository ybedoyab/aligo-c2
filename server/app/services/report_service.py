"""Mission report generation (Markdown + JSON)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlmodel import Session

from app.models.mission import Mission
from app.core.iot_plugins import IOT_PLUGINS
from app.services import iot_service, ledger_service, mission_service, node_service, result_service, task_service

_REPO_ROOT = Path(__file__).resolve().parents[3]
_REPORTS_DIR = _REPO_ROOT / "demo" / "reports"


def build_mission_report(session: Session, mission_id: str) -> dict[str, Any] | None:
    mission = mission_service.get_mission(session, mission_id)
    if mission is None:
        return None

    tasks = task_service.list_tasks_for_mission(session, mission_id)
    results = []
    errors: list[dict[str, Any]] = []
    ledger_rows: list[dict[str, Any]] = []
    timeline: list[dict[str, Any]] = []

    for task in tasks:
        result = result_service.get_result_for_task(session, task.id)
        if result:
            row = {
                "task_id": task.id,
                "node_id": task.node_id,
                "plugin": task.plugin,
                "status": str(task.status),
                "exit_code": result.exit_code,
                "duration_ms": result.duration_ms,
                "stdout": result.stdout[:500],
                "stderr": result.stderr[:500],
            }
            if task.plugin in IOT_PLUGINS:
                iot_extra = iot_service.build_iot_evidence_extras(
                    task=task,
                    node=node_service.get_node(session, task.node_id),
                    result=result,
                )
                if iot_extra:
                    row.update(
                        {
                            "device_id": iot_extra.get("device_id"),
                            "device_type": iot_extra.get("device_type"),
                            "evidence_class": iot_extra.get("evidence_class"),
                            "iot_summary": iot_extra.get("iot_summary"),
                        }
                    )
            results.append(row)
        if task.status in {"failed", "timeout", "blocked_by_policy"}:
            errors.append(
                {
                    "task_id": task.id,
                    "node_id": task.node_id,
                    "plugin": task.plugin,
                    "status": str(task.status),
                }
            )

        evt = ledger_service.get_primary_result_event(session, task.id)
        if evt:
            verify = ledger_service.verify_event(session, evt.id)
            ledger_rows.append(
                {
                    "event_id": evt.id,
                    "event_type": str(evt.event_type),
                    "payload_hash": evt.payload_hash,
                    "tx_hash": evt.tx_hash,
                    "block_number": evt.block_number,
                    "onchain_status": str(evt.onchain_status),
                    "integrity_status": verify.status if verify else "unknown",
                }
            )

    events = ledger_service.list_events(session, limit=500)
    for evt in reversed(events):
        if evt.mission_id != mission_id:
            continue
        timeline.append(
            {
                "sequence": evt.sequence,
                "event_type": str(evt.event_type),
                "task_id": evt.task_id,
                "node_id": evt.node_id,
                "timestamp": evt.timestamp,
                "onchain_status": str(evt.onchain_status),
            }
        )

    target_nodes = []
    for nid in mission.target_node_ids:
        node = node_service.get_node(session, nid)
        target_nodes.append(
            {
                "id": nid,
                "alias": node.alias if node else "",
                "status": str(node.status) if node else "unknown",
                "policy_id": node.policy_id if node else "",
            }
        )

    successes = sum(1 for t in tasks if t.status == "success")
    iot_summary_line = iot_service.iot_mission_summary(session, mission_id)
    gateway = node_service.get_node(session, "gateway-sim-001")
    iot_section: dict[str, Any] | None = None
    if any(t.plugin in IOT_PLUGINS for t in tasks) or mission.id.startswith("mission-iot"):
        iot_section = {
            "gateway": gateway.id if gateway else "gateway-sim-001",
            "gateway_online": gateway.status.value == "online" if gateway else False,
            "subdevices": (gateway.iot_devices if gateway else None) or [],
            "device_states": iot_service.parse_led_state((gateway.iot_devices if gateway else None) or []),
            "executed_actions": [
                {
                    "task_id": t.id,
                    "plugin": t.plugin,
                    "device_id": t.args.get("device_id"),
                    "status": str(t.status),
                }
                for t in tasks
                if t.plugin in IOT_PLUGINS
            ],
            "summary_line": iot_summary_line,
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mission": {
            "id": mission.id,
            "name": mission.name,
            "description": mission.description,
            "status": str(mission.status),
            "steps": mission.steps,
            "created_at": mission.created_at.isoformat(),
            "started_at": mission.started_at.isoformat() if mission.started_at else None,
            "completed_at": mission.completed_at.isoformat() if mission.completed_at else None,
        },
        "target_nodes": target_nodes,
        "summary": {
            "total_tasks": len(tasks),
            "successful_tasks": successes,
            "failed_tasks": len(tasks) - successes,
            "ledger_events": len(timeline),
            "iot_summary": iot_summary_line,
        },
        "iot": iot_section,
        "tasks": [
            {
                "id": t.id,
                "node_id": t.node_id,
                "plugin": t.plugin,
                "status": str(t.status),
                "created_at": t.created_at.isoformat(),
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in tasks
        ],
        "results": results,
        "errors": errors,
        "ledger": ledger_rows,
        "timeline": timeline,
    }


def report_to_markdown(report: dict[str, Any]) -> str:
    m = report["mission"]
    lines = [
        f"# Mission Report: {m['name']}",
        "",
        f"- **ID:** `{m['id']}`",
        f"- **Status:** {m['status']}",
        f"- **Generated:** {report['generated_at']}",
        "",
        "## Summary",
        "",
        f"- Tasks: {report['summary']['total_tasks']} "
        f"({report['summary']['successful_tasks']} ok, "
        f"{report['summary']['failed_tasks']} failed/blocked)",
        f"- Ledger events: {report['summary']['ledger_events']}",
        "",
        "## Target nodes",
        "",
    ]
    for n in report["target_nodes"]:
        lines.append(f"- `{n['id']}` — {n['status']} — policy `{n['policy_id']}`")
    if report.get("iot"):
        iot = report["iot"]
        lines.extend(["", "## IoT execution", ""])
        if iot.get("summary_line"):
            lines.append(iot["summary_line"])
        lines.append(f"- Gateway: `{iot.get('gateway')}` (online={iot.get('gateway_online')})")
        for action in iot.get("executed_actions") or []:
            lines.append(
                f"- `{action['plugin']}` device={action.get('device_id') or '—'} "
                f"status={action['status']}"
            )
    lines.extend(["", "## Timeline", ""])
    for row in report["timeline"]:
        lines.append(
            f"- [{row['sequence']}] **{row['event_type']}** "
            f"node={row['node_id'] or '—'} task={row['task_id'] or '—'} "
            f"chain={row['onchain_status']}"
        )
    lines.extend(["", "## Errors", ""])
    if not report["errors"]:
        lines.append("_None_")
    else:
        for e in report["errors"]:
            lines.append(f"- `{e['task_id']}` {e['plugin']} on {e['node_id']}: **{e['status']}**")
    return "\n".join(lines) + "\n"


def save_report_files(session: Session, mission_id: str) -> dict[str, str] | None:
    report = build_mission_report(session, mission_id)
    if report is None:
        return None
    _REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = _REPORTS_DIR / f"{mission_id}-{stamp}.json"
    md_path = _REPORTS_DIR / f"{mission_id}-{stamp}.md"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    md_path.write_text(report_to_markdown(report), encoding="utf-8")
    return {"json": str(json_path.relative_to(_REPO_ROOT)), "markdown": str(md_path.relative_to(_REPO_ROOT))}
