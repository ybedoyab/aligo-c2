# Vulnerability scanning (lab)

The **Vulnerabilities Issues** dashboard runs authorized, lab-safe recon on connected
nodes and correlates findings with optional OSINT.

## Flow

1. **Trigger** — manual button in the UI or daily cron (`VULN_SCAN_CRON_ENABLED`).
2. **Recon** — mission steps using allowlisted plugins only: `health_check`,
   `system_info`, `network_info`, `list_lab_directory`.
3. **Facts** — server parses task stdout JSON per node.
4. **OSINT** — server-side searches (graceful degradation without API keys).
5. **Issues** — persisted findings with severity, source, and evidence links.
6. **Report** — JSON/Markdown export via API or UI.

## OSINT sources

| Source | Key required | Notes |
|--------|--------------|-------|
| **NVD** | `NVD_API_KEY` optional | CVE keyword search; higher rate limit with key |
| **OSV** | No | Package/version and keyword search |
| **CISA KEV** | No | Cached 24h; elevates severity for known exploited CVEs |
| **Hacker News** | No | Algolia API |
| **Stack Exchange Security** | `STACKEXCHANGE_KEY` optional | security.stackexchange.com |
| **GitHub issues** | `GITHUB_TOKEN` | Issue search |
| **GitHub GHSA** | `GITHUB_TOKEN` | Advisory lookup for CVEs found in other hits |
| **Reddit** | No | Public JSON API (`REDDIT_CLIENT_*` unused) |
| **X** | `X_BEARER_TOKEN` | Skipped if empty |

Disable individual sources with `OSINT_ENABLED_SOURCES` (comma-separated list).

## Limits

This is **not** a CVE scanner or port scanner. It does not violate
[limitations.md](./limitations.md): no network scanning, exploitation, or exfiltration.

Results are **indicative** for lab demonstration and operator awareness.

## Configuration

| Variable | Purpose |
|----------|---------|
| `VULN_SCAN_CRON_ENABLED` | Enable scheduled scans (default `true`) |
| `VULN_SCAN_INTERVAL_HOURS` | Hours between cron runs (default `24`) |
| `GITHUB_TOKEN` | GitHub search + GHSA advisories |
| `NVD_API_KEY` | Optional NVD API key |
| `STACKEXCHANGE_KEY` | Optional Stack Exchange API key |
| `X_BEARER_TOKEN` | Optional X/Twitter API v2 |
| `OSINT_ENABLED_SOURCES` | Subset of sources to run (empty = all) |
| `ANTHROPIC_API_KEY` | Optional narrative summary on scan completion |

## API

- `GET /api/vulnerabilities/scans`
- `POST /api/vulnerabilities/scans` — manual trigger
- `GET /api/vulnerabilities/issues`
- `GET /api/vulnerabilities/scans/{id}/report?format=json|markdown`

WebSocket events: `vulnerability_scan_update`, `vulnerability_issue`.
