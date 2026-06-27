"""OSINT search helpers for vulnerability correlation (server-side only)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("aligo.vuln.osint")

_CVE_RE = re.compile(r"CVE-\d{4}-\d+", re.IGNORECASE)
_TIMEOUT = 12.0
_USER_AGENT = "AligoC2-Lab-OSINT/1.0"
_HIT_LIMIT = 5
_KEV_URL = (
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
)
_KEV_TTL_SECONDS = 86400

_kev_cache: dict[str, Any] = {"expires_at": 0.0, "cves": frozenset()}


def _source_enabled(name: str) -> bool:
    return name in settings.resolved_osint_sources()


def normalize_plugin_facts(node_facts: dict[str, Any]) -> dict[str, Any]:
    """Recon facts are keyed by plugin name (system_info); normalize for analysis."""
    return {
        "system": node_facts.get("system_info") or node_facts.get("system") or {},
        "network": node_facts.get("network_info") or node_facts.get("network") or {},
        "health": node_facts.get("health_check") or {},
        "lab_dir": node_facts.get("list_lab_directory") or {},
    }


def _queries_from_facts(node_facts: dict[str, Any]) -> list[str]:
    """Build search queries from recon facts for a single node."""
    queries: list[str] = []
    normalized = normalize_plugin_facts(node_facts)
    system = normalized["system"]
    network = normalized["network"]

    os_name = system.get("os") or ""
    os_release = system.get("os_release") or ""
    os_version = system.get("os_version") or ""
    hostname = system.get("hostname") or network.get("hostname") or ""
    python_ver = system.get("python_version") or ""
    platform_str = system.get("platform") or ""

    if os_name and os_release:
        queries.append(f"{os_name} {os_release} vulnerability")
    if os_name and os_version:
        queries.append(f"{os_name} security advisory")
    if platform_str:
        queries.append(f"{platform_str} CVE")
    if python_ver:
        queries.append(f"Python {python_ver} security vulnerability")
    if hostname and hostname != "localhost" and hostname != "127.0.0.1":
        queries.append(f"{hostname} security")

    seen: set[str] = set()
    unique: list[str] = []
    for q in queries:
        key = q.lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(q)
    return unique[:6]


def _nvd_cvss_score(vuln: dict[str, Any]) -> float | None:
    metrics = vuln.get("cve", {}).get("metrics", {})
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = metrics.get(key) or []
        if entries:
            data = entries[0].get("cvssData", {})
            score = data.get("baseScore")
            if score is not None:
                return float(score)
    return None


async def search_nvd(query: str, limit: int = _HIT_LIMIT) -> list[dict[str, Any]]:
    if not _source_enabled("nvd"):
        return []
    headers = {"User-Agent": _USER_AGENT}
    if settings.nvd_api_key:
        headers["apiKey"] = settings.nvd_api_key
    url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    params = {"keywordSearch": query, "resultsPerPage": limit}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                logger.warning("NVD search failed: %s %s", resp.status_code, resp.text[:200])
                return []
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("NVD search error: %s", exc)
        return []

    hits: list[dict[str, Any]] = []
    for item in data.get("vulnerabilities", [])[:limit]:
        cve = item.get("cve", {})
        cve_id = cve.get("id", "")
        descriptions = cve.get("descriptions", [])
        desc = ""
        for d in descriptions:
            if d.get("lang") == "en":
                desc = d.get("value", "")
                break
        if not desc and descriptions:
            desc = descriptions[0].get("value", "")
        hits.append(
            {
                "title": f"{cve_id}: {desc[:120]}" if cve_id else desc[:200],
                "url": f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id else "",
                "body": desc[:500],
                "source": "nvd",
                "cve_id": cve_id,
                "cvss_score": _nvd_cvss_score(item),
            }
        )
    return hits


async def search_osv(node_facts: dict[str, Any], limit: int = _HIT_LIMIT) -> list[dict[str, Any]]:
    if not _source_enabled("osv"):
        return []
    normalized = normalize_plugin_facts(node_facts)
    system = normalized["system"]
    python_ver = system.get("python_version") or ""
    os_name = (system.get("os") or "").lower()
    hits: list[dict[str, Any]] = []

    async def _query_osv(body: dict[str, Any]) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    "https://api.osv.dev/v1/query",
                    json=body,
                    headers={"User-Agent": _USER_AGENT},
                )
                if resp.status_code != 200:
                    return []
                data = resp.json()
        except httpx.HTTPError as exc:
            logger.warning("OSV query error: %s", exc)
            return []

        out: list[dict[str, Any]] = []
        for vuln in data.get("vulns", [])[:limit]:
            vid = vuln.get("id", "")
            summary = vuln.get("summary") or vuln.get("details") or vid
            aliases = vuln.get("aliases", [])
            cve_id = next((a for a in aliases if a.upper().startswith("CVE-")), "")
            out.append(
                {
                    "title": f"{vid}: {summary[:120]}",
                    "url": f"https://osv.dev/vulnerability/{vid}",
                    "body": (vuln.get("details") or summary)[:500],
                    "source": "osv",
                    "cve_id": cve_id,
                }
            )
        return out

    if python_ver:
        hits.extend(
            await _query_osv(
                {"package": {"name": "CPython", "ecosystem": "GIT"}, "version": python_ver}
            )
        )
        if len(hits) < limit:
            hits.extend(
                await _query_osv(
                    {
                        "package": {"name": "python", "ecosystem": "PyPI"},
                        "version": python_ver,
                    }
                )
            )

    if os_name and len(hits) < limit:
        search_q = f"{os_name} {system.get('os_release', '')}".strip()
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    "https://api.osv.dev/v1/search",
                    json={"query": search_q},
                    headers={"User-Agent": _USER_AGENT},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for vuln in data.get("vulns", [])[:limit]:
                        vid = vuln.get("id", "")
                        summary = vuln.get("summary") or vid
                        hits.append(
                            {
                                "title": f"{vid}: {summary[:120]}",
                                "url": f"https://osv.dev/vulnerability/{vid}",
                                "body": (vuln.get("details") or summary)[:500],
                                "source": "osv",
                                "cve_id": next(
                                    (
                                        a
                                        for a in vuln.get("aliases", [])
                                        if a.upper().startswith("CVE-")
                                    ),
                                    "",
                                ),
                            }
                        )
        except httpx.HTTPError as exc:
            logger.warning("OSV search error: %s", exc)

    return hits[:limit]


async def fetch_cisa_kev() -> frozenset[str]:
    """Return CVE IDs from CISA Known Exploited Vulnerabilities catalog (cached 24h)."""
    if not _source_enabled("cisa_kev"):
        return frozenset()

    now = time.monotonic()
    if now < _kev_cache["expires_at"] and _kev_cache["cves"]:
        return _kev_cache["cves"]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(_KEV_URL, headers={"User-Agent": _USER_AGENT})
            if resp.status_code != 200:
                logger.warning("CISA KEV fetch failed: %s", resp.status_code)
                return _kev_cache.get("cves", frozenset())
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("CISA KEV fetch error: %s", exc)
        return _kev_cache.get("cves", frozenset())

    cves: set[str] = set()
    for entry in data.get("vulnerabilities", []):
        cve = entry.get("cveID") or entry.get("cve_id")
        if cve:
            cves.add(cve.upper())

    _kev_cache["cves"] = frozenset(cves)
    _kev_cache["expires_at"] = now + _KEV_TTL_SECONDS
    logger.info("CISA KEV catalog loaded: %d CVEs", len(cves))
    return _kev_cache["cves"]


async def search_hackernews(query: str, limit: int = _HIT_LIMIT) -> list[dict[str, Any]]:
    if not _source_enabled("hackernews"):
        return []
    url = "https://hn.algolia.com/api/v1/search"
    params = {"query": query, "tags": "story", "hitsPerPage": limit}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params=params, headers={"User-Agent": _USER_AGENT})
            if resp.status_code != 200:
                logger.warning("HN search failed: %s", resp.status_code)
                return []
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("HN search error: %s", exc)
        return []

    hits: list[dict[str, Any]] = []
    for item in data.get("hits", [])[:limit]:
        title = item.get("title", "")
        story_id = item.get("objectID", "")
        hits.append(
            {
                "title": title,
                "url": f"https://news.ycombinator.com/item?id={story_id}",
                "body": (item.get("story_text") or title)[:500],
                "source": "hackernews",
            }
        )
    return hits


async def search_stackexchange(query: str, limit: int = _HIT_LIMIT) -> list[dict[str, Any]]:
    if not _source_enabled("stackexchange"):
        return []
    params: dict[str, Any] = {
        "order": "desc",
        "sort": "relevance",
        "intitle": query,
        "site": "security",
        "pagesize": limit,
    }
    if settings.stackexchange_key:
        params["key"] = settings.stackexchange_key
    url = "https://api.stackexchange.com/2.3/search"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params=params, headers={"User-Agent": _USER_AGENT})
            if resp.status_code != 200:
                logger.warning("StackExchange search failed: %s", resp.status_code)
                return []
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("StackExchange search error: %s", exc)
        return []

    hits: list[dict[str, Any]] = []
    for item in data.get("items", [])[:limit]:
        qid = item.get("question_id", "")
        hits.append(
            {
                "title": item.get("title", ""),
                "url": item.get("link") or f"https://security.stackexchange.com/q/{qid}",
                "body": (item.get("body_markdown") or item.get("title", ""))[:500],
                "source": "stackexchange",
            }
        )
    return hits


async def search_github_advisory(cve_id: str) -> dict[str, Any] | None:
    """Fetch GitHub Security Advisory for a CVE when GITHUB_TOKEN is set."""
    if not _source_enabled("ghsa") or not settings.github_token or not cve_id:
        return None
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {settings.github_token}",
        "User-Agent": _USER_AGENT,
    }
    url = "https://api.github.com/advisories"
    params = {"cve_id": cve_id, "per_page": 1}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                return None
            items = resp.json()
            if not items:
                return None
            adv = items[0]
            ghsa = adv.get("ghsa_id", "")
            summary = adv.get("summary") or adv.get("description", "")
            return {
                "title": f"GHSA {ghsa}: {summary[:120]}",
                "url": f"https://github.com/advisories/{ghsa}" if ghsa else "",
                "body": (adv.get("description") or summary)[:500],
                "source": "ghsa",
                "cve_id": cve_id,
                "severity": adv.get("severity", ""),
            }
    except httpx.HTTPError as exc:
        logger.warning("GHSA lookup error for %s: %s", cve_id, exc)
    return None


async def search_github(query: str, limit: int = _HIT_LIMIT) -> list[dict[str, Any]]:
    if not _source_enabled("github") or not settings.github_token:
        return []
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {settings.github_token}",
        "User-Agent": _USER_AGENT,
    }
    url = "https://api.github.com/search/issues"
    params = {"q": query, "per_page": limit, "sort": "updated"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                logger.warning("GitHub search failed: %s %s", resp.status_code, resp.text[:200])
                return []
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("GitHub search error: %s", exc)
        return []

    hits: list[dict[str, Any]] = []
    for item in data.get("items", [])[:limit]:
        hits.append(
            {
                "title": item.get("title", ""),
                "url": item.get("html_url", ""),
                "body": (item.get("body") or "")[:500],
                "source": "github",
            }
        )
    return hits


async def search_reddit(query: str, limit: int = _HIT_LIMIT) -> list[dict[str, Any]]:
    """Public Reddit search; REDDIT_CLIENT_* env vars are not used."""
    if not _source_enabled("reddit"):
        return []
    url = "https://www.reddit.com/search.json"
    params = {"q": query, "limit": limit, "sort": "relevance"}
    headers = {"User-Agent": _USER_AGENT}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                logger.warning("Reddit search failed: %s", resp.status_code)
                return []
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("Reddit search error: %s", exc)
        return []

    hits: list[dict[str, Any]] = []
    children = data.get("data", {}).get("children", [])
    for child in children[:limit]:
        post = child.get("data", {})
        hits.append(
            {
                "title": post.get("title", ""),
                "url": f"https://www.reddit.com{post.get('permalink', '')}",
                "body": (post.get("selftext") or "")[:500],
                "source": "reddit",
            }
        )
    return hits


async def search_x(query: str, limit: int = _HIT_LIMIT) -> list[dict[str, Any]]:
    if not _source_enabled("x") or not settings.x_bearer_token:
        return []
    url = "https://api.twitter.com/2/tweets/search/recent"
    headers = {
        "Authorization": f"Bearer {settings.x_bearer_token}",
        "User-Agent": _USER_AGENT,
    }
    params = {"query": query, "max_results": min(limit, 10)}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                logger.warning("X search failed: %s %s", resp.status_code, resp.text[:200])
                return []
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("X search error: %s", exc)
        return []

    hits: list[dict[str, Any]] = []
    for item in data.get("data", [])[:limit]:
        hits.append(
            {
                "title": item.get("text", "")[:200],
                "url": f"https://x.com/i/web/status/{item.get('id', '')}",
                "body": item.get("text", ""),
                "source": "x",
            }
        )
    return hits


def detect_cves(text: str) -> list[str]:
    return list({m.upper() for m in _CVE_RE.findall(text)})


async def run_osint_for_node(node_facts: dict[str, Any]) -> list[dict[str, Any]]:
    """Run all enabled OSINT sources for facts from one node."""
    all_hits: list[dict[str, Any]] = []
    queries = _queries_from_facts(node_facts)

    osv_hits = await search_osv(node_facts)
    for hit in osv_hits:
        hit["query"] = "osv:package/version"
        all_hits.append(hit)

    for query in queries:
        for hit in await search_nvd(query):
            hit["query"] = query
            all_hits.append(hit)
        for hit in await search_github(query):
            hit["query"] = query
            all_hits.append(hit)
        for hit in await search_reddit(query):
            hit["query"] = query
            all_hits.append(hit)
        for hit in await search_x(query):
            hit["query"] = query
            all_hits.append(hit)
        for hit in await search_hackernews(query):
            hit["query"] = query
            all_hits.append(hit)
        for hit in await search_stackexchange(query):
            hit["query"] = query
            all_hits.append(hit)

    return all_hits
