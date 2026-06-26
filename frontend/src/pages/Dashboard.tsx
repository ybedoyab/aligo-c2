import { Link } from "react-router-dom";
import { TimelineReplay } from "../components/TimelineReplay";
import { HealthBadge, StatusBadge } from "../components/HealthBadge";
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
  const { nodes, missions, tasks, ledger } = useC2();

  const online = nodes.filter((a) => a.status === "online").length;
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
          Real-time view of nodes, missions and the verifiable execution ledger.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric label="Nodes online" value={online} accent="text-soc-ok" />
        <Metric label="Active missions" value={activeMissions} accent="text-soc-accent" />
        <Metric label="Tasks completed" value={completedTasks} accent="text-soc-ok" />
        <Metric label="Tasks failed" value={failedTasks} accent="text-soc-err" />
        <Metric label="Ledger events" value={ledger.length} accent="text-soc-accent2" />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Fleet topology</h3>
          <Link to="/topology" className="text-xs text-soc-accent hover:underline">
            Open full topology →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-lg border border-soc-border px-3 py-2 text-white">Operator UI</span>
          <span className="text-soc-muted">→</span>
          <span className="rounded-lg border border-soc-border px-3 py-2 text-white">C2 Server</span>
          <span className="text-soc-muted">→</span>
          <span className="rounded-lg border border-soc-accent/40 px-3 py-2 text-soc-accent">
            {online} node(s) online
          </span>
          <span className="text-soc-muted">→</span>
          <span className="rounded-lg border border-soc-border px-3 py-2 text-white">Blockchain ledger</span>
        </div>
        {nodes.filter((n) => n.status === "online").length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {nodes
              .filter((n) => n.status === "online")
              .slice(0, 6)
              .map((n) => (
                <Link
                  key={n.id}
                  to={`/nodes/${n.id}`}
                  className="flex items-center gap-2 rounded-lg border border-soc-border px-3 py-2 text-xs hover:border-soc-accent"
                >
                  <StatusBadge status={n.status} />
                  <span className="font-mono text-white">{n.alias || n.id}</span>
                  <HealthBadge score={n.health_score} />
                </Link>
              ))}
          </div>
        )}
      </div>

      <TimelineReplay events={ledger} missions={missions} tasks={tasks} />
    </div>
  );
}
