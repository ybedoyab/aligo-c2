import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { NodeDetail, NodePolicy, NodeUpdate } from "../types";
import { useI18n } from "../i18n";
import {
  HealthBadge,
  IntegrityBadge,
  NodeMetaBadges,
  StatusBadge,
} from "../components/HealthBadge";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";

export function NodeDetailPage() {
  const { t, timeAgo, translateError } = useI18n();
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
      .catch((e) => setError(translateError((e as Error).message)));
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
      setError(translateError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!nodeId || !detail) return;
    if (detail.node.status !== "offline") {
      setError(t("errors.deleteOfflineOnly"));
      return;
    }
    if (!confirm(t("nodeDetail.deleteConfirm", { nodeId }))) return;
    try {
      await api.deleteNode(nodeId);
      navigate("/nodes");
    } catch (e) {
      setError(translateError((e as Error).message));
    }
  };

  if (error && !detail) {
    return (
      <div className="text-soc-err">
        {error}{" "}
        <Link to="/nodes" className="text-soc-accent">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <div className="text-soc-muted">{t("common.loadingNode")}</div>;
  }

  const { node, stats, last_heartbeat, health, tasks } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/nodes" className="text-xs text-soc-accent hover:underline">
            {t("nodeDetail.backToNodes")}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("nodeDetail.healthScore")}
          value={<HealthBadge score={node.health_score} />}
        />
        <StatCard label={t("nodeDetail.totalTasks")} value={stats.total_tasks} />
        <StatCard
          label={t("nodeDetail.successful")}
          value={stats.successful_tasks}
          accent="text-soc-ok"
        />
        <StatCard
          label={t("nodeDetail.failed")}
          value={stats.failed_tasks}
          accent="text-soc-err"
        />
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-white mb-3">{t("nodeDetail.healthBreakdown")}</h3>
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
        <h3 className="md:col-span-2 text-sm font-semibold text-white">
          {t("nodeDetail.registryMetadata")}
        </h3>
        <Field
          label={t("nodeDetail.alias")}
          value={edit.alias ?? ""}
          onChange={(v) => setEdit((e) => ({ ...e, alias: v }))}
        />
        <Field
          label={t("nodes.group")}
          value={edit.group ?? ""}
          onChange={(v) => setEdit((e) => ({ ...e, group: v }))}
        />
        <label className="flex flex-col gap-1 text-xs text-soc-muted md:col-span-2">
          {t("nodeDetail.tagsComma")}
          <input
            className="input"
            value={(edit.tags ?? []).join(", ")}
            onChange={(e) =>
              setEdit((x) => ({
                ...x,
                tags: e.target.value.split(",").map((tag) => tag.trim()),
              }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-soc-muted md:col-span-2">
          {t("nodeDetail.description")}
          <textarea
            className="input min-h-[60px]"
            value={edit.description ?? ""}
            onChange={(e) => setEdit((x) => ({ ...x, description: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          {t("nodes.policy")}
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
          {t("nodeDetail.nodeType")}
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
            <option value="real">{t("nodeType.real")}</option>
            <option value="simulated">{t("nodeType.simulated")}</option>
            <option value="ai_analyst">{t("nodeType.ai_analyst_placeholder")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-soc-muted">
          <input
            type="checkbox"
            checked={edit.enabled ?? true}
            onChange={(e) => setEdit((x) => ({ ...x, enabled: e.target.checked }))}
          />
          {t("nodeDetail.enabledInRegistry")}
        </label>
        <label className="flex items-center gap-2 text-sm text-soc-muted">
          <input
            type="checkbox"
            checked={edit.trusted ?? true}
            onChange={(e) => setEdit((x) => ({ ...x, trusted: e.target.checked }))}
          />
          {t("status.trusted")}
        </label>
        <div className="md:col-span-2 flex gap-2">
          <button className="btn-primary text-xs" onClick={save} disabled={busy}>
            {busy ? t("common.saving") : t("nodeDetail.saveMetadata")}
          </button>
          {node.status === "offline" && (
            <button className="btn-ghost text-xs text-soc-err" onClick={remove}>
              {t("nodeDetail.deleteOfflineNode")}
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Info label={t("nodes.os")} value={node.os} dash={t("common.dash")} />
        <Info label={t("nodeDetail.user")} value={node.username} dash={t("common.dash")} />
        <Info label={t("nodes.lastSeen")} value={timeAgo(node.last_seen)} />
        <Info label={t("nodes.lastHeartbeat")} value={timeAgo(last_heartbeat)} />
      </div>

      <div className="card-static overflow-hidden">
        <div className="panel-header">
          {t("nodeDetail.taskHistory")}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs uppercase text-soc-muted border-b border-soc-border">
              <th className="px-4 py-2">{t("nodeDetail.plugin")}</th>
              <th className="px-4 py-2">{t("nodeDetail.mission")}</th>
              <th className="px-4 py-2">{t("taskConsole.status")}</th>
              <th className="px-4 py-2">{t("nodeDetail.duration")}</th>
              <th className="px-4 py-2">{t("nodeDetail.integrity")}</th>
              <th className="px-4 py-2 text-right">{t("nodeDetail.evidence")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-soc-muted">
                  {t("nodeDetail.noTasks")}
                </td>
              </tr>
            )}
            {tasks.map((task) => (
              <tr
                key={task.task_id}
                className="border-b border-soc-borderSubtle/60 row-hover cursor-pointer"
                onClick={() => setEvidenceTaskId(task.task_id)}
              >
                <td className="px-4 py-2 font-mono text-soc-accent">{task.plugin}</td>
                <td className="px-4 py-2 text-xs text-soc-muted font-mono">{task.mission_id}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-2 text-xs text-soc-muted">
                  {task.duration_ms != null
                    ? `${task.duration_ms} ${t("common.ms")}`
                    : t("common.dash")}
                </td>
                <td className="px-4 py-2">
                  <IntegrityBadge status={task.integrity_status} />
                </td>
                <td className="px-4 py-2 text-right text-xs text-soc-accent">
                  {t("common.viewArrow")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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

function Info({ label, value, dash }: { label: string; value: string; dash?: string }) {
  return (
    <div>
      <div className="text-xs text-soc-muted">{label}</div>
      <div className="text-white">{value || dash || "—"}</div>
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
