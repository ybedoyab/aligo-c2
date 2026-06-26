import { useState } from "react";
import { api } from "../api/client";
import { MissionBuilder } from "../components/MissionBuilder";
import { ResultViewer } from "../components/ResultViewer";
import { TaskConsole } from "../components/TaskConsole";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";
import { StatusBadge } from "../components/HealthBadge";
import { useC2 } from "../store";
import type { Mission } from "../types";
import { downloadMissionReport } from "../utils/missionReport";

function ExportButtons({ missionId }: { missionId: string }) {
  const [busy, setBusy] = useState(false);
  const run = async (format: "json" | "markdown") => {
    setBusy(true);
    try {
      await downloadMissionReport(missionId, format);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-1 ml-2">
      <button className="btn-ghost text-xs" disabled={busy} onClick={() => run("json")}>
        Export JSON
      </button>
      <button className="btn-ghost text-xs" disabled={busy} onClick={() => run("markdown")}>
        Export MD
      </button>
    </div>
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
        `${report.ready ? "READY" : "BLOCKED"} — ${report.summary} (${report.tasks_to_dispatch} to dispatch)`
      );
    } catch (e) {
      setError((e as Error).message);
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
      if (targets.length === 0) throw new Error("no nodes online");
      await api.startMission(mission.id, targets);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{mission.name}</span>
          {mission.is_predefined && (
            <span className="text-[10px] uppercase tracking-wide text-soc-accent2">
              preset
            </span>
          )}
          <StatusBadge status={mission.status} />
        </div>
        <div className="text-xs text-soc-muted mt-0.5">{mission.description}</div>
        <div className="text-[11px] text-soc-muted font-mono mt-1">
          steps: {mission.steps.map((s) => s.plugin).join(" → ")}
        </div>
        {mission.merkle_root && (
          <div className="text-[11px] text-soc-accent font-mono mt-1">
            merkle root: {mission.merkle_root.slice(0, 16)}… · {mission.merkle_root_status}
          </div>
        )}
        {dryRun && <div className="text-xs text-soc-warn mt-1">{dryRun}</div>}
        {error && <div className="text-xs text-soc-err mt-1">{error}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button className="btn-ghost text-xs" onClick={dryRunMission} disabled={busy}>
          Dry run
        </button>
        <button className="btn-primary text-xs" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Run"}
        </button>
        <ExportButtons missionId={mission.id} />
      </div>
    </div>
  );
}

export function Missions() {
  const { missions, nodes, tasks, results, refreshAll } = useC2();
  const onlineIds = nodes.filter((a) => a.status === "online").map((a) => a.id);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Missions</h1>
        <p className="text-sm text-soc-muted">
          Reusable, multi-step missions executed across one or more nodes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Library</h2>
          {missions.map((m) => (
            <MissionRow
              key={m.id}
              mission={m}
              onlineIds={onlineIds}
              onChanged={refreshAll}
            />
          ))}
        </div>
        <MissionBuilder nodes={nodes} onChanged={refreshAll} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskConsole tasks={tasks.slice(0, 30)} onOpenEvidence={setEvidenceTaskId} />
        <ResultViewer
          results={results.slice(0, 15)}
          tasks={tasks}
          onOpenEvidence={setEvidenceTaskId}
        />
      </div>

      <TaskEvidenceModal
        taskId={evidenceTaskId}
        onClose={() => setEvidenceTaskId(null)}
      />
    </div>
  );
}
