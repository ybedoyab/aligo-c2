import { useState } from "react";
import { api } from "../api/client";
import { MissionBuilder } from "../components/MissionBuilder";
import { ResultViewer } from "../components/ResultViewer";
import { TaskConsole } from "../components/TaskConsole";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";
import { StatusBadge } from "../components/HealthBadge";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { Mission } from "../types";
import { downloadMissionReport } from "../utils/missionReport";

function ExportButtons({ missionId, disabled }: { missionId: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = async (format: "json" | "markdown") => {
    setBusy(true);
    try {
      await downloadMissionReport(missionId, format);
    } finally {
      setBusy(false);
    }
  };
  const isDisabled = disabled || busy;
  return (
    <>
      <button className="btn-ghost text-xs" disabled={isDisabled} onClick={() => run("json")}>
        {t("common.exportJson")}
      </button>
      <button className="btn-ghost text-xs" disabled={isDisabled} onClick={() => run("markdown")}>
        {t("common.exportMd")}
      </button>
    </>
  );
}

function MissionRow({
  mission,
  onlineIds,
  onChanged,
}: {
  mission: Mission;
  onlineIds: string[];
  onChanged: () => void;
}) {
  const { t, status, translateError } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dryRun, setDryRun] = useState<string | null>(null);

  const dryRunMission = async () => {
    setBusy(true);
    setError("");
    setDryRun(null);
    try {
      const targets = mission.target_node_ids.length
        ? mission.target_node_ids
        : onlineIds;
      const report = await api.dryRunMission(mission.id, targets);
      setDryRun(
        `${status(report.ready ? "READY" : "BLOCKED")} — ${report.summary} (${t("common.toDispatch", { count: report.tasks_to_dispatch })})`
      );
    } catch (e) {
      setError(translateError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const targets = mission.target_node_ids.length
        ? mission.target_node_ids
        : onlineIds;
      if (targets.length === 0) throw new Error(t("errors.noNodesOnline"));
      await api.startMission(mission.id, targets);
      onChanged();
    } catch (e) {
      setError(translateError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-white">{mission.name}</span>
          {mission.is_predefined && (
            <span className="text-[10px] uppercase tracking-wide text-soc-accent2">
              {t("common.preset")}
            </span>
          )}
          <StatusBadge status={mission.status} />
        </div>
        <div className="text-xs text-soc-muted mt-0.5">{mission.description}</div>
        <div className="text-[11px] text-soc-muted font-mono mt-1 break-words">
          {t("common.steps")}: {mission.steps.map((s) => s.plugin).join(" → ")}
        </div>
        {mission.merkle_root && (
          <div className="text-[11px] text-soc-accent font-mono mt-1 break-all">
            {t("common.merkleRoot")}: {mission.merkle_root.slice(0, 16)}… ·{" "}
            {status(mission.merkle_root_status ?? "unknown")}
          </div>
        )}
        {dryRun && <div className="text-xs text-soc-warn mt-2">{dryRun}</div>}
        {error && <div className="text-xs text-soc-err mt-2">{error}</div>}
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-soc-border">
        <button className="btn-ghost text-xs" onClick={dryRunMission} disabled={busy}>
          {t("missions.dryRun")}
        </button>
        <button className="btn-primary text-xs" onClick={start} disabled={busy}>
          {busy ? t("common.starting") : t("common.run")}
        </button>
        <ExportButtons missionId={mission.id} disabled={busy} />
      </div>
    </div>
  );
}

export function Missions() {
  const { t } = useI18n();
  const { missions, nodes, tasks, results, refreshAll } = useC2();
  const onlineIds = nodes.filter((a) => a.status === "online").map((a) => a.id);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("missions.title")}</h1>
        <p className="text-sm text-soc-muted">{t("missions.description")}</p>
      </div>

      <div className="card-static overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left row-hover transition-all duration-200"
          onClick={() => setBuilderOpen((open) => !open)}
          aria-expanded={builderOpen}
        >
          <span className="text-sm font-semibold text-white">{t("missions.buildMission")}</span>
          <svg
            className={`h-4 w-4 shrink-0 text-soc-muted transition-transform ${
              builderOpen ? "rotate-180" : ""
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {builderOpen && (
          <div className="border-t border-soc-border p-4 sm:p-5">
            <MissionBuilder nodes={nodes} onChanged={refreshAll} embedded />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">{t("missions.library")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map((m) => (
            <MissionRow
              key={m.id}
              mission={m}
              onlineIds={onlineIds}
              onChanged={refreshAll}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <TaskConsole tasks={tasks.slice(0, 30)} onOpenEvidence={setEvidenceTaskId} />
        <ResultViewer
          results={results.slice(0, 15)}
          tasks={tasks}
          onOpenEvidence={setEvidenceTaskId}
        />
      </div>

      <TaskEvidenceModal taskId={evidenceTaskId} onClose={() => setEvidenceTaskId(null)} />
    </div>
  );
}
