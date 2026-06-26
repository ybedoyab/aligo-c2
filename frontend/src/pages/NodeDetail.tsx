import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { NodeDetail } from "../types";
import { formatTime, timeAgo } from "../utils";
import { HealthBadge, IntegrityBadge, StatusBadge } from "../components/HealthBadge";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";

export function NodeDetailPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [error, setError] = useState("");
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  const load = () => {
    if (!nodeId) return;
    api
      .getNodeDetail(nodeId)
      .then(setDetail)
      .catch((e) => setError((e as Error).message));
  };

  useEffect(load, [nodeId]);

  if (error) {
    return (
      <div className="text-soc-err">
        {error}{" "}
        <Link to="/nodes" className="text-soc-accent">
          Back
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <div className="text-soc-muted">Loading node…</div>;
  }

  const { node, stats, last_heartbeat, tasks } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/nodes" className="text-xs text-soc-accent hover:underline">
            ← Nodes
          </Link>
          <h1 className="text-xl font-semibold text-white font-mono mt-1">{node.id}</h1>
          <p className="text-sm text-soc-muted">{node.hostname}</p>
        </div>
        <StatusBadge status={node.status} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Health score" value={<HealthBadge score={node.health_score} />} />
        <StatCard label="Total tasks" value={stats.total_tasks} />
        <StatCard label="Successful" value={stats.successful_tasks} accent="text-soc-ok" />
        <StatCard label="Failed" value={stats.failed_tasks} accent="text-soc-err" />
      </div>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Info label="OS" value={node.os} />
        <Info label="User" value={node.username} />
        <Info label="Last seen" value={timeAgo(node.last_seen)} />
        <Info label="Last heartbeat" value={timeAgo(last_heartbeat)} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-soc-border font-semibold text-white text-sm">
          Task history
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-soc-muted border-b border-soc-border">
              <th className="px-4 py-2">Plugin</th>
              <th className="px-4 py-2">Mission</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Integrity</th>
              <th className="px-4 py-2 text-right">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-soc-muted">
                  No tasks yet for this node.
                </td>
              </tr>
            )}
            {tasks.map((t) => (
              <tr
                key={t.task_id}
                className="border-b border-soc-border/40 hover:bg-soc-panel2/50 cursor-pointer"
                onClick={() => setEvidenceTaskId(t.task_id)}
              >
                <td className="px-4 py-2 font-mono text-soc-accent">{t.plugin}</td>
                <td className="px-4 py-2 text-xs text-soc-muted font-mono">{t.mission_id}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-2 text-xs text-soc-muted">
                  {t.duration_ms != null ? `${t.duration_ms} ms` : "—"}
                  {t.exit_code != null && ` · exit ${t.exit_code}`}
                </td>
                <td className="px-4 py-2">
                  <IntegrityBadge status={t.integrity_status} />
                </td>
                <td className="px-4 py-2 text-right text-xs text-soc-muted">
                  {formatTime(t.completed_at ?? t.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TaskEvidenceModal taskId={evidenceTaskId} onClose={() => setEvidenceTaskId(null)} />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-soc-muted uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? "text-white"}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-soc-muted">{label}</div>
      <div className="text-white">{value || "—"}</div>
    </div>
  );
}
