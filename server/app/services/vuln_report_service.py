"""Vulnerability scan report generation (JSON + Markdown)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlmodel import Session

from app.services import vuln_scan_service

_REPO_ROOT = Path(__file__).resolve().parents[3]
_REPORTS_DIR = _REPO_ROOT / "demo" / "reports"


def build_scan_report(session: Session, scan_id: str) -> dict[str, Any] | None:
    scan = vuln_scan_service.get_scan(session, scan_id)
    if scan is None:
        return None

    issues = vuln_scan_service.list_issues(session, scan_id=scan_id, limit=500)
    by_severity: dict[str, int] = {}
    by_node: dict[str, int] = {}
    for issue in issues:
        sev = str(issue.severity)
        by_severity[sev] = by_severity.get(sev, 0) + 1
        by_node[issue.node_id] = by_node.get(issue.node_id, 0) + 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scan": {
            "id": scan.id,
            "status": str(scan.status),
            "trigger": str(scan.trigger),
            "mission_id": scan.mission_id,
            "node_ids": scan.node_ids,
            "issue_count": scan.issue_count,
            "summary": scan.summary,
            "error_message": scan.error_message,
            "created_at": scan.created_at.isoformat(),
            "started_at": scan.started_at.isoformat() if scan.started_at else None,
            "finished_at": scan.finished_at.isoformat() if scan.finished_at else None,
        },
        "summary": {
            "total_issues": len(issues),
            "by_severity": by_severity,
            "by_node": by_node,
        },
        "facts": scan.facts,
        "issues": [
            {
                "id": i.id,
                "node_id": i.node_id,
                "title": i.title,
                "description": i.description,
                "severity": str(i.severity),
                "source": str(i.source),
                "evidence_url": i.evidence_url,
                "matched_fact": i.matched_fact,
                "confidence": i.confidence,
                "status": str(i.status),
                "created_at": i.created_at.isoformat(),
            }
            for i in issues
        ],
    }


def report_to_markdown(report: dict[str, Any]) -> str:
    s = report["scan"]
    lines = [
        f"# Vulnerability Scan Report",
        "",
        f"- **Scan ID:** `{s['id']}`",
        f"- **Status:** {s['status']}",
        f"- **Trigger:** {s['trigger']}",
        f"- **Generated:** {report['generated_at']}",
        "",
        "## Summary",
        "",
        f"- Total issues: {report['summary']['total_issues']}",
    ]
    for sev, count in sorted(report["summary"]["by_severity"].items()):
        lines.append(f"- {sev}: {count}")

    if s.get("summary"):
        lines.extend(["", "## AI Summary", "", s["summary"]])

    lines.extend(["", "## Issues by node", ""])
    for node_id, count in report["summary"]["by_node"].items():
        lines.append(f"- `{node_id}`: {count} issue(s)")

    lines.extend(["", "## Findings", ""])
    if not report["issues"]:
        lines.append("_No issues recorded._")
    else:
        for issue in report["issues"]:
            lines.append(
                f"### [{issue['severity']}] {issue['title']}"
            )
            lines.append(f"- Node: `{issue['node_id']}`")
            lines.append(f"- Source: {issue['source']}")
            if issue.get("evidence_url"):
                lines.append(f"- Evidence: {issue['evidence_url']}")
            if issue.get("matched_fact"):
                lines.append(f"- Matched: {issue['matched_fact']}")
            lines.append(f"- Confidence: {issue['confidence']}")
            if issue.get("description"):
                lines.append("")
                lines.append(issue["description"])
            lines.append("")

    return "\n".join(lines) + "\n"


def save_report_files(session: Session, scan_id: str) -> dict[str, str] | None:
    report = build_scan_report(session, scan_id)
    if report is None:
        return None
    _REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = _REPORTS_DIR / f"vuln-scan-{scan_id}-{stamp}.json"
    md_path = _REPORTS_DIR / f"vuln-scan-{scan_id}-{stamp}.md"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    md_path.write_text(report_to_markdown(report), encoding="utf-8")
    return {
        "json": str(json_path.relative_to(_REPO_ROOT)),
        "markdown": str(md_path.relative_to(_REPO_ROOT)),
    }
