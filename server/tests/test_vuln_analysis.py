"""Unit tests for vulnerability analysis heuristics and severity logic."""

from __future__ import annotations

from app.core.enums import VulnIssueSource, VulnSeverity
from app.services.vuln_analysis_service import (
    _heuristic_issues,
    _issues_from_osint,
    _sanitize_evidence_url,
    _severity_from_hit,
)


def test_severity_kev_cve_is_critical():
    kev = frozenset({"CVE-2024-0001"})
    hit = {"cve_id": "CVE-2024-0001", "cvss_score": 5.0}
    assert (
        _severity_from_hit(hit, "CVE-2024-0001 buffer overflow", "nvd", kev)
        == VulnSeverity.CRITICAL
    )


def test_severity_nvd_cvss_high():
    kev: frozenset[str] = frozenset()
    hit = {"cve_id": "CVE-2024-9999", "cvss_score": 8.5}
    assert (
        _severity_from_hit(hit, "remote code execution", "nvd", kev)
        == VulnSeverity.HIGH
    )


def test_severity_hackernews_is_info():
    kev: frozenset[str] = frozenset()
    hit = {"title": "Discussion on patching"}
    assert (
        _severity_from_hit(hit, hit["title"], "hackernews", kev)
        == VulnSeverity.INFO
    )


def test_heuristic_windows_host_medium():
    facts = {
        "system_info": {"os": "windows", "os_release": "10", "python_version": "3.12.0"},
        "network_info": {"hostname": "lab-node"},
    }
    issues = _heuristic_issues("node-1", facts)
    titles = [i.title for i in issues]
    assert any("Windows" in t for t in titles)
    assert any(i.severity == VulnSeverity.MEDIUM for i in issues)


def test_heuristic_old_python_low():
    facts = {
        "system_info": {"os": "linux", "python_version": "3.8.10"},
        "network_info": {},
    }
    issues = _heuristic_issues("node-1", facts)
    assert any("Python 3.8" in i.title for i in issues)
    assert any(i.severity == VulnSeverity.LOW for i in issues)


def test_heuristic_network_policy_gap():
    facts = {"system_info": {"os": "linux", "python_version": "3.12.0"}}
    issues = _heuristic_issues("node-1", facts)
    assert any(i.source == VulnIssueSource.HEURISTIC for i in issues)
    assert any("Network recon blocked" in i.title for i in issues)


def test_sanitize_evidence_url_rejects_non_http():
    assert _sanitize_evidence_url("javascript:alert(1)") is None
    assert _sanitize_evidence_url("ftp://example.com/x") is None
    assert _sanitize_evidence_url("https://nvd.nist.gov/vuln/detail/CVE-2024-1") is not None


def test_issues_from_osint_strips_bad_evidence_url():
    kev: frozenset[str] = frozenset()
    hits = [
        {
            "title": "Sample advisory",
            "body": "details",
            "source": "nvd",
            "url": "javascript:evil()",
            "query": "linux vulnerability",
        }
    ]
    issues = _issues_from_osint("scan-1", "node-1", hits, kev)
    assert len(issues) == 1
    assert issues[0].evidence_url is None
