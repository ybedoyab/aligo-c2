import { TimelineReplay } from "../components/TimelineReplay";
import { useC2 } from "../store";

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-soc-muted">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${accent ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { agents, missions, tasks, ledger } = useC2();

  const online = agents.filter((a) => a.status === "online").length;
  const activeMissions = missions.filter((m) => m.status === "running").length;
  const completedTasks = tasks.filter((t) => t.status === "success").length;
  const failedTasks = tasks.filter(
    (t) => t.status === "failed" || t.status === "timeout"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Operations Dashboard</h1>
        <p className="text-sm text-soc-muted">
          Real-time view of agents, missions and the verifiable execution ledger.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric label="Agents online" value={online} accent="text-soc-ok" />
        <Metric label="Active missions" value={activeMissions} accent="text-soc-accent" />
        <Metric label="Tasks completed" value={completedTasks} accent="text-soc-ok" />
        <Metric label="Tasks failed" value={failedTasks} accent="text-soc-err" />
        <Metric label="Ledger events" value={ledger.length} accent="text-soc-accent2" />
      </div>

      <TimelineReplay events={ledger} />
    </div>
  );
}
