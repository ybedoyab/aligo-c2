"""Vulnerability scan REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlmodel import Session

from app.core.enums import VulnScanTrigger
from app.db.database import get_session
from app.schemas.vulnerability import (
    VulnerabilityIssueRead,
    VulnerabilityScanCreate,
    VulnerabilityScanRead,
)
from app.services import vuln_report_service, vuln_scan_service

router = APIRouter(prefix="/api/vulnerabilities", tags=["vulnerabilities"])


@router.get("/scans", response_model=list[VulnerabilityScanRead])
def list_scans(session: Session = Depends(get_session)) -> list[VulnerabilityScanRead]:
    return [
        VulnerabilityScanRead.model_validate(s) for s in vuln_scan_service.list_scans(session)
    ]


@router.get("/scans/{scan_id}", response_model=VulnerabilityScanRead)
def get_scan(scan_id: str, session: Session = Depends(get_session)) -> VulnerabilityScanRead:
    scan = vuln_scan_service.get_scan(session, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="scan not found")
    return VulnerabilityScanRead.model_validate(scan)


@router.post("/scans", response_model=VulnerabilityScanRead, status_code=201)
async def create_scan(
    body: VulnerabilityScanCreate | None = None,
    session: Session = Depends(get_session),
) -> VulnerabilityScanRead:
    node_ids = body.node_ids if body else []
    try:
        scan = await vuln_scan_service.trigger_scan(
            trigger=VulnScanTrigger.MANUAL,
            node_ids=node_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return VulnerabilityScanRead.model_validate(scan)


@router.get("/issues", response_model=list[VulnerabilityIssueRead])
def list_issues(
    scan_id: str | None = Query(default=None),
    node_id: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[VulnerabilityIssueRead]:
    issues = vuln_scan_service.list_issues(
        session,
        scan_id=scan_id,
        node_id=node_id,
        severity=severity,
    )
    return [VulnerabilityIssueRead.model_validate(i) for i in issues]


@router.get("/scans/{scan_id}/report")
def export_scan_report(
    scan_id: str,
    format: str = Query(default="json", pattern="^(json|markdown)$"),
    save: bool = Query(default=False),
    session: Session = Depends(get_session),
):
    report = vuln_report_service.build_scan_report(session, scan_id)
    if report is None:
        raise HTTPException(status_code=404, detail="scan not found")
    saved = vuln_report_service.save_report_files(session, scan_id) if save else None
    if format == "markdown":
        body = vuln_report_service.report_to_markdown(report)
        return PlainTextResponse(
            content=body,
            media_type="text/markdown",
            headers={"X-Report-Saved": str(saved) if saved else ""},
        )
    return JSONResponse(content={"report": report, "saved_paths": saved})
