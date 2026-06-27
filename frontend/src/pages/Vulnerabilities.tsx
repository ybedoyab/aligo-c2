import { useMemo, useState } from "react";
import { api } from "../api/client";
import { StatusBadge } from "../components/HealthBadge";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { VulnerabilityIssue, VulnSeverity } from "../types";
import { downloadVulnScanReport } from "../utils/vulnReport";

const SEVERITIES: VulnSeverity[] = ["critical", "high", "medium", "low", "info"];

function ExportButtons({ scanId, disabled }: { scanId: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = async (format: "json" | "markdown") => {
    setBusy(true);
    try {
      await downloadVulnScanReport(scanId, format);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="btn-ghost text-xs" disabled={disabled || busy} onClick={() => run("json")}>
        {t("common.exportJson")}
      </button>
      <button
        className="btn-ghost text-xs"
        disabled={disabled || busy}
        onClick={() => run("markdown")}
      >
        {t("common.exportMd")}
      </button>
    </>
  );
}

export function Vulnerabilities() {
  const { t, status, translateError } = useI18n();
  const { vulnScans, vulnIssues, nodes, refreshAll } = useC2();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterNode, setFilterNode] = useState("");
  const [filterScan, setFilterScan] = useState("");

  const latestScan = vulnScans[0];
  const running = vulnScans.some((s) => s.status === "running" || s.status === "pending");

  const filteredIssues = useMemo(() => {
    return vulnIssues.filter((issue) => {
      if (filterSeverity && issue.severity !== filterSeverity) return false;
      if (filterNode && issue.node_id !== filterNode) return false;
      if (filterScan && issue.scan_id !== filterScan) return false;
      return true;
    });
  }, [vulnIssues, filterSeverity, filterNode, filterScan]);

  const runScan = async () => {
    setBusy(true);
    setError("");
    try {
      await api.triggerVulnScan();
      await refreshAll();
    } catch (e) {
      setError(translateError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">{t("vulnerabilities.title")}</h1>
          <p className="text-sm text-soc-muted">{t("vulnerabilities.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {latestScan && (
            <span className="text-xs text-soc-muted">
              {t("vulnerabilities.lastScan")}:{" "}
              <StatusBadge status={latestScan.status} /> ·{" "}
              <StatusBadge status={latestScan.trigger} />
            </span>
          )}
          <button
            className="btn-primary text-sm"
            onClick={runScan}
            disabled={busy || running}
          >
            {busy || running ? t("vulnerabilities.scanning") : t("vulnerabilities.runScan")}
          </button>
        </div>
      </div>

      {running && (
        <div className="card p-3 text-sm text-soc-accent">{t("vulnerabilities.scanRunning")}</div>
      )}
      {error && <div className="text-sm text-soc-err">{error}</div>}
      {latestScan?.error_message && (
        <div className="card p-3 text-sm text-soc-err">
          {t("vulnerabilities.scanFailed")}: {latestScan.error_message}
        </div>
      )}
      {latestScan?.summary && (
        <div className="card p-4">
          <h2 className="text-sm font-medium text-white mb-2">{t("vulnerabilities.summary")}</h2>
          <p className="text-sm text-soc-muted">{latestScan.summary}</p>
        </div>
      )}

      <div className="card p-4">
        <h2 className="text-sm font-medium text-white mb-3">{t("vulnerabilities.scanHistory")}</h2>
        {vulnScans.length === 0 ? (
          <p className="text-sm text-soc-muted">{t("vulnerabilities.noScans")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-soc-muted border-b border-soc-border">
                  <th className="py-2 pr-4 text-left">ID</th>
                  <th className="py-2 pr-4 text-left">{t("ledger.status")}</th>
                  <th className="py-2 pr-4 text-left">{t("vulnerabilities.trigger")}</th>
                  <th className="py-2 pr-4 text-left">{t("vulnerabilities.issues")}</th>
                  <th className="py-2 text-left">{t("common.export")}</th>
                </tr>
              </thead>
              <tbody>
                {vulnScans.slice(0, 10).map((scan) => (
                  <tr key={scan.id} className="border-b border-soc-border/50">
                    <td className="py-2 pr-4 font-mono text-soc-accent">{scan.id}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={scan.status} />
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={scan.trigger} />
                    </td>
                    <td className="py-2 pr-4">{scan.issue_count}</td>
                    <td className="py-2">
                      <ExportButtons scanId={scan.id} disabled={scan.status !== "completed"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <h2 className="text-sm font-medium text-white flex-1">{t("vulnerabilities.issues")}</h2>
          <label className="text-xs text-soc-muted">
            {t("vulnerabilities.filterSeverity")}
            <select
              className="mt-1 block rounded border border-soc-border bg-soc-bg px-2 py-1 text-white"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{status(s)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-soc-muted">
            {t("vulnerabilities.filterNode")}
            <select
              className="mt-1 block rounded border border-soc-border bg-soc-bg px-2 py-1 text-white"
              value={filterNode}
              onChange={(e) => setFilterNode(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.id}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-soc-muted">
            {t("vulnerabilities.filterScan")}
            <select
              className="mt-1 block rounded border border-soc-border bg-soc-bg px-2 py-1 text-white"
              value={filterScan}
              onChange={(e) => setFilterScan(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {vulnScans.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </label>
        </div>

        {filteredIssues.length === 0 ? (
          <p className="text-sm text-soc-muted">{t("vulnerabilities.noIssues")}</p>
        ) : (
          <div className="space-y-3">
            {filteredIssues.map((issue: VulnerabilityIssue) => (
              <div
                key={issue.id}
                className="rounded border border-soc-border p-3 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={issue.severity} />
                  <StatusBadge status={issue.source} />
                  <span className="text-sm font-medium text-white">{issue.title}</span>
                </div>
                <div className="text-xs text-soc-muted font-mono">
                  {t("vulnerabilities.filterNode")}: {issue.node_id} · scan: {issue.scan_id}
                </div>
                {issue.matched_fact && (
                  <div className="text-xs text-soc-muted">
                    {t("vulnerabilities.matchedFact")}: {issue.matched_fact}
                  </div>
                )}
                <div className="text-xs text-soc-muted">
                  {t("vulnerabilities.confidence")}: {(issue.confidence * 100).toFixed(0)}%
                </div>
                {issue.description && (
                  <p className="text-sm text-soc-muted">{issue.description}</p>
                )}
                {issue.evidence_url && (
                  <a
                    href={issue.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-soc-accent hover:underline"
                  >
                    {t("vulnerabilities.evidence")} →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
