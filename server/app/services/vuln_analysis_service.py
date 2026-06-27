"""Correlate recon facts and OSINT hits into vulnerability issues."""

from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx
from sqlmodel import Session

from app.core.config import settings
from app.core.enums import VulnIssueSource, VulnIssueStatus, VulnSeverity
from app.models.vulnerability_issue import VulnerabilityIssue
from app.services.vuln_osint_service import (
    detect_cves,
    normalize_plugin_facts,
    run_osint_for_node,
    search_github_advisory,
)

logger = logging.getLogger("aligo.vuln.analysis")


def _severity_from_hit(
    hit: dict[str, Any],
    text: str,
    source: str,
    kev_cves: frozenset[str],
) -> VulnSeverity:
    text_lower = text.lower()
    cve_id = (hit.get("cve_id") or "").upper()
    cves = detect_cves(text)
    if cve_id:
        cves = list({cve_id, *cves})

    if cves and any(c in kev_cves for c in cves):
        return VulnSeverity.CRITICAL

    cvss = hit.get("cvss_score")
    if source == "nvd" and cvss is not None:
        if cvss >= 9.0:
            return VulnSeverity.CRITICAL
        if cvss >= 7.0:
            return VulnSeverity.HIGH
        if cvss >= 4.0:
            return VulnSeverity.MEDIUM
        return VulnSeverity.LOW

    if cves and ("critical" in text_lower or "exploit" in text_lower):
        return VulnSeverity.CRITICAL
    if cves:
        return VulnSeverity.HIGH

    if source == "osv":
        return VulnSeverity.HIGH if cves else VulnSeverity.MEDIUM
    if source == "ghsa":
        sev = (hit.get("severity") or "").lower()
        if sev == "critical":
            return VulnSeverity.CRITICAL
        if sev == "high":
            return VulnSeverity.HIGH
        if sev == "medium":
            return VulnSeverity.MEDIUM
        return VulnSeverity.LOW
    if source == "cisa_kev":
        return VulnSeverity.CRITICAL
    if "security advisory" in text_lower or "vulnerability" in text_lower:
        return VulnSeverity.MEDIUM if source in ("github", "nvd") else VulnSeverity.LOW
    if source in ("hackernews", "stackexchange", "reddit"):
        return VulnSeverity.INFO
    if source == "x":
        return VulnSeverity.LOW
    return VulnSeverity.INFO


def _source_enum(source: str) -> VulnIssueSource:
    mapping = {
        "github": VulnIssueSource.GITHUB,
        "reddit": VulnIssueSource.REDDIT,
        "x": VulnIssueSource.X,
        "nvd": VulnIssueSource.NVD,
        "osv": VulnIssueSource.OSV,
        "cisa_kev": VulnIssueSource.CISA_KEV,
        "hackernews": VulnIssueSource.HACKERNEWS,
        "stackexchange": VulnIssueSource.STACKEXCHANGE,
        "ghsa": VulnIssueSource.GHSA,
    }
    return mapping.get(source, VulnIssueSource.OSINT)


def _heuristic_issues(node_id: str, node_facts: dict[str, Any]) -> list[VulnerabilityIssue]:
    """Local heuristics from recon facts without external APIs."""
    issues: list[VulnerabilityIssue] = []
    normalized = normalize_plugin_facts(node_facts)
    system = normalized["system"]
    network = normalized["network"]
    lab_dir = normalized["lab_dir"]

    os_name = (system.get("os") or "").lower()
    python_ver = system.get("python_version") or ""
    memory = system.get("total_memory_mb")

    # network_info missing while other recon succeeded → likely policy block
    if system and not network and "network_info" not in node_facts:
        issues.append(
            VulnerabilityIssue(
                id=f"vuln-{uuid.uuid4().hex[:12]}",
                scan_id="",
                node_id=node_id,
                title="Network recon blocked — policy gap",
                description=(
                    "system_info succeeded but network_info was not collected. "
                    "The node policy may block network_info; limited network visibility in scans."
                ),
                severity=VulnSeverity.MEDIUM,
                source=VulnIssueSource.HEURISTIC,
                matched_fact="network_info absent after recon",
                confidence=0.6,
            )
        )

    if lab_dir.get("entries"):
        entry_count = len(lab_dir.get("entries", []))
        if entry_count > 0:
            issues.append(
                VulnerabilityIssue(
                    id=f"vuln-{uuid.uuid4().hex[:12]}",
                    scan_id="",
                    node_id=node_id,
                    title=f"Lab workspace listing — {entry_count} entries visible",
                    description=(
                        "Sandbox directory audit returned file names. Review for sensitive "
                        "artifacts in the lab workspace path."
                    ),
                    severity=VulnSeverity.INFO,
                    source=VulnIssueSource.HEURISTIC,
                    matched_fact=f"list_lab_directory entries={entry_count}",
                    confidence=0.35,
                )
            )

    if os_name == "windows" and system.get("os_release"):
        issues.append(
            VulnerabilityIssue(
                id=f"vuln-{uuid.uuid4().hex[:12]}",
                scan_id="",
                node_id=node_id,
                title=f"Windows {system.get('os_release')} — review security updates",
                description=(
                    "Lab recon detected a Windows host. Verify patch level and "
                    "enabled services in an authorized audit."
                ),
                severity=VulnSeverity.MEDIUM,
                source=VulnIssueSource.HEURISTIC,
                matched_fact=f"os={os_name}, release={system.get('os_release')}",
                confidence=0.55,
            )
        )

    if python_ver.startswith("3.8") or python_ver.startswith("3.9"):
        issues.append(
            VulnerabilityIssue(
                id=f"vuln-{uuid.uuid4().hex[:12]}",
                scan_id="",
                node_id=node_id,
                title=f"Python {python_ver} may be approaching end-of-support",
                description=(
                    "Older Python runtimes can miss security fixes. "
                    "Consider upgrading in authorized maintenance windows."
                ),
                severity=VulnSeverity.LOW,
                source=VulnIssueSource.HEURISTIC,
                matched_fact=f"python_version={python_ver}",
                confidence=0.45,
            )
        )

    if memory is not None and isinstance(memory, int) and memory < 512:
        issues.append(
            VulnerabilityIssue(
                id=f"vuln-{uuid.uuid4().hex[:12]}",
                scan_id="",
                node_id=node_id,
                title="Low memory host — resource exhaustion risk",
                description=(
                    f"Detected ~{memory} MB RAM. Resource pressure can amplify "
                    "denial-of-service impact in lab scenarios."
                ),
                severity=VulnSeverity.INFO,
                source=VulnIssueSource.HEURISTIC,
                matched_fact=f"total_memory_mb={memory}",
                confidence=0.4,
            )
        )

    return issues


def _recon_baseline_issue(
    scan_id: str,
    node_id: str,
    node_facts: dict[str, Any],
) -> VulnerabilityIssue:
    """Informational issue so completed scans always surface recon context in the UI."""
    normalized = normalize_plugin_facts(node_facts)
    system = normalized["system"]
    plugins = [k for k in node_facts if k != "node_id"]
    os_line = ""
    if system.get("os"):
        os_line = f"{system.get('os')} {system.get('os_release', '')}".strip()
    desc = (
        f"Recon plugins collected: {', '.join(plugins)}. "
        f"OS snapshot: {os_line or 'unknown'}. "
        "No external OSINT matches were promoted to findings for this node."
    )
    return VulnerabilityIssue(
        id=f"vuln-{uuid.uuid4().hex[:12]}",
        scan_id=scan_id,
        node_id=node_id,
        title="Recon baseline — scan data collected",
        description=desc,
        severity=VulnSeverity.INFO,
        source=VulnIssueSource.HEURISTIC,
        matched_fact=f"plugins={plugins}",
        confidence=0.3,
    )


def _issues_from_osint(
    scan_id: str,
    node_id: str,
    hits: list[dict[str, Any]],
    kev_cves: frozenset[str],
) -> list[VulnerabilityIssue]:
    issues: list[VulnerabilityIssue] = []
    seen_titles: set[str] = set()

    for hit in hits:
        title = (hit.get("title") or "").strip()
        if not title or title.lower() in seen_titles:
            continue
        seen_titles.add(title.lower())

        body = hit.get("body") or ""
        combined = f"{title} {body}"
        source = hit.get("source", "osint")
        severity = _severity_from_hit(hit, combined, source, kev_cves)
        cves = detect_cves(combined)
        cve_id = (hit.get("cve_id") or "").upper()
        if cve_id:
            cves = list({cve_id, *cves})

        desc = body[:400] if body else f"OSINT match for query: {hit.get('query', '')}"
        if cves:
            desc = f"CVE references: {', '.join(cves)}. {desc}"
        if cves and any(c in kev_cves for c in cves):
            desc = f"CISA KEV listed. {desc}"

        confidence = 0.7 if cves else 0.5
        if cves and any(c in kev_cves for c in cves):
            confidence = 0.95

        issues.append(
            VulnerabilityIssue(
                id=f"vuln-{uuid.uuid4().hex[:12]}",
                scan_id=scan_id,
                node_id=node_id,
                title=title[:200],
                description=desc,
                severity=severity,
                source=_source_enum(source),
                evidence_url=hit.get("url"),
                matched_fact=hit.get("query"),
                confidence=confidence,
            )
        )

    return issues[:20]


async def _enrich_with_ghsa(
    hits: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Add GHSA advisories for CVEs already found in other OSINT hits."""
    if not settings.github_token:
        return hits
    cves: set[str] = set()
    for hit in hits:
        cve = (hit.get("cve_id") or "").upper()
        if cve:
            cves.add(cve)
        cves.update(detect_cves(f"{hit.get('title', '')} {hit.get('body', '')}"))

    extra: list[dict[str, Any]] = []
    for cve in list(cves)[:5]:
        adv = await search_github_advisory(cve)
        if adv:
            adv["query"] = f"ghsa:{cve}"
            extra.append(adv)
    return hits + extra


async def analyze_node(
    session: Session,
    scan_id: str,
    node_id: str,
    node_facts: dict[str, Any],
    kev_cves: frozenset[str],
) -> list[VulnerabilityIssue]:
    """Produce issues for one node from heuristics + OSINT."""
    issues: list[VulnerabilityIssue] = []

    for item in _heuristic_issues(node_id, node_facts):
        item.scan_id = scan_id
        issues.append(item)

    try:
        hits = await run_osint_for_node(node_facts)
        hits = await _enrich_with_ghsa(hits)
        issues.extend(_issues_from_osint(scan_id, node_id, hits, kev_cves))
    except Exception as exc:
        logger.warning("OSINT failed for node %s: %s", node_id, exc)

    if not issues and node_facts:
        issues.append(_recon_baseline_issue(scan_id, node_id, node_facts))

    for issue in issues:
        session.add(issue)
    session.commit()
    return issues


async def optional_llm_summary(
    facts: dict[str, Any],
    issues: list[VulnerabilityIssue],
) -> str | None:
    """Optional narrative summary via Anthropic API when configured."""
    api_key = settings.anthropic_api_key.strip()
    if not api_key:
        return None

    issue_lines = [
        f"- [{i.severity}] {i.title} (node={i.node_id}, source={i.source})"
        for i in issues[:20]
    ]
    prompt = (
        "Summarize this lab vulnerability scan in 2-3 sentences for a security operator. "
        "Be factual; note these are indicative findings from authorized lab recon + OSINT.\n\n"
        f"Facts summary: {list(facts.keys())}\n"
        f"Findings ({len(issues)}):\n" + "\n".join(issue_lines)
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 300,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            if resp.status_code != 200:
                logger.warning(
                    "Anthropic summary failed: %s — check ANTHROPIC_API_KEY in .env",
                    resp.status_code,
                )
                return None
            data = resp.json()
            blocks = data.get("content", [])
            if blocks and blocks[0].get("type") == "text":
                return blocks[0].get("text", "").strip()
    except httpx.HTTPError as exc:
        logger.warning("Anthropic summary error: %s", exc)
    return None
