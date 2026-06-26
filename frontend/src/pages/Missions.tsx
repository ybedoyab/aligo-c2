import { useState } from "react";
import { api } from "../api/client";
import { MissionBuilder } from "../components/MissionBuilder";
import { ResultViewer } from "../components/ResultViewer";
import { TaskConsole } from "../components/TaskConsole";
import { StatusBadge } from "../components/HealthBadge";
import { useC2 } from "../store";
import type { Mission } from "../types";

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

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const targets = mission.target_agent_ids.length
        ? mission.target_agent_ids
        : onlineIds;
      if (targets.length === 0) throw new Error("no agents online");
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
        {error && <div className="text-xs text-soc-err mt-1">{error}</div>}
      </div>
      <button className="btn-primary text-xs" onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Run"}
      </button>
    </div>
  );
}

export function Missions() {
  const { missions, agents, tasks, results, refreshAll } = useC2();
  const onlineIds = agents.filter((a) => a.status === "online").map((a) => a.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Missions</h1>
        <p className="text-sm text-soc-muted">
          Reusable, multi-step missions executed across one or more agents.
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
        <MissionBuilder agents={agents} onChanged={refreshAll} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskConsole tasks={tasks.slice(0, 30)} />
        <ResultViewer results={results.slice(0, 15)} />
      </div>
    </div>
  );
}
