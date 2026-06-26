import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { NodeDetail, NodePolicy, NodeUpdate } from "../types";
import { timeAgo } from "../utils";
import {
  HealthBadge,
  IntegrityBadge,
  NodeMetaBadges,
  StatusBadge,
} from "../components/HealthBadge";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";

export function NodeDetailPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [policies, setPolicies] = useState<NodePolicy[]>([]);
  const [edit, setEdit] = useState<NodeUpdate>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  const load = () => {
    if (!nodeId) return;
    api
      .getNodeDetail(nodeId)
      .then((d) => {
        setDetail(d);
        setEdit({
          alias: d.node.alias,
          tags: d.node.tags,
          group: d.node.group,
          description: d.node.description,
          enabled: d.node.enabled,
          trusted: d.node.trusted,
          node_type: d.node.node_type,
          policy_id: d.node.policy_id,
        });
      })
      .catch((e) => setError((e as Error).message));
  };

  useEffect(() => {
    load();
    api.listPolicies().then(setPolicies).catch(() => {});
  }, [nodeId]);

  const save = async () => {
    if (!nodeId) return;
    setBusy(true);
    setError("");
    try {
      await api.updateNode(nodeId, {
        ...edit,
        tags: (edit.tags as string[] | undefined)?.filter(Boolean) ?? [],
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!nodeId || !detail) return;
    if (detail.node.status !== "offline") {
      setError("Only offline nodes can be deleted from the registry.");
      return;
    }
    if (!confirm(`Delete registry entry for ${nodeId}?`)) return;
    try {
      await api.deleteNode(nodeId);
      navigate("/nodes");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !detail) {
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

  const { node, stats, last_heartbeat, health, tasks } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/nodes" className="text-xs text-soc-accent hover:underline">
            ← Nodes
          </Link>
          <h1 className="text-xl font-semibold text-white font-mono mt-1">
            {node.alias || node.id}
          </h1>
          <p className="text-sm text-soc-muted">{node.hostname}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={node.enabled ? node.status : "disabled"} />
          <NodeMetaBadges
            enabled={node.enabled}
            trusted={node.trusted}
            nodeType={node.node_type}
          />
        </div>
      </div>

      {error && <div className="text-sm text-soc-err">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Health score" value={<HealthBadge score={node.health_score} />} />
        <StatCard label="Total tasks" value={stats.total_tasks} />
        <StatCard label="Successful" value={stats.successful_tasks} accent="text-soc-ok" />
        <StatCard label="Failed" value={stats.failed_tasks} accent="text-soc-err" />
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Health score breakdown</h3>
        <div className="space-y-2">
          {health.factors.map((f) => (
            <div key={f.label} className="flex items-center justify-between text-sm gap-4">
              <div>
                <span className="text-white">{f.label}</span>
                <p className="text-xs text-soc-muted">{f.detail}</p>
              </div>
              <span className="font-mono text-soc-accent">{f.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h3 className="md:col-span-2 text-sm font-semibold text-white">Registry metadata</h3>
        <Field label="Alias" value={edit.alias ?? ""} onChange={(v) => setEdit((e) => ({ ...e, alias: v }))} />
        <Field label="Group" value={edit.group ?? ""} onChange={(v) => setEdit((e) => ({ ...e, group: v }))} />
        <label className="flex flex-col gap-1 text-xs text-soc-muted md:col-span-2">
          Tags (comma-separated)
          <input
            className="input"
            value={(edit.tags ?? []).join(", ")}
            onChange={(e) =>
              setEdit((x) => ({
                ...x,
                tags: e.target.value.split(",").map((t) => t.trim()),
              }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-soc-muted md:col-span-2">
          Description
          <textarea
            className="input min-h-[60px]"
            value={edit.description ?? ""}
            onChange={(e) => setEdit((x) => ({ ...x, description: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          Policy
          <select
            className="input"
            value={edit.policy_id ?? "basic_safe"}
            onChange={(e) => setEdit((x) => ({ ...x, policy_id: e.target.value }))}
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          Node type
          <select
            className="input"
            value={edit.node_type ?? "real"}
            onChange={(e) =>
              setEdit((x) => ({
                ...x,
                node_type: e.target.value as NodeUpdate["node_type"],
              }))
            }
          >
            <option value="real">real</option>
            <option value="simulated">simulated</option>
            <option value="ai_analyst">ai_analyst (placeholder)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-soc-muted">
          <input
            type="checkbox"
            checked={edit.enabled ?? true}
            onChange={(e) => setEdit((x) => ({ ...x, enabled: e.target.checked }))}
          />
          Enabled in registry
        </label>
        <label className="flex items-center gap-2 text-sm text-soc-muted">
          <input
            type="checkbox"
            checked={edit.trusted ?? true}
            onChange={(e) => setEdit((x) => ({ ...x, trusted: e.target.checked }))}
          />
          Trusted
        </label>
        <div className="md:col-span-2 flex gap-2">
          <button className="btn-primary text-xs" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save metadata"}
          </button>
          {node.status === "offline" && (
            <button className="btn-ghost text-xs text-soc-err" onClick={remove}>
              Delete offline node
            </button>
          )}
        </div>
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
                </td>
                <td className="px-4 py-2">
                  <IntegrityBadge status={t.integrity_status} />
                </td>
                <td className="px-4 py-2 text-right text-xs text-soc-accent">View →</td>
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

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-soc-muted">
      {label}
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
