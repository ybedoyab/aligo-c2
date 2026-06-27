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
import { Select } from "../components/Select";
import {
  ClockIcon,
  CompletedTasksIcon,
  DeviceIcon,
  FailedTasksIcon,
  GaugeIcon,
  HeartPulseIcon,
  MissionsIcon,
  UserIcon,
  type NavIcon,
} from "../components/icons";

const HEALTH_FACTOR = {
  HEARTBEAT: "Heartbeat",
  TASK_SUCCESS: "Task success rate",
  LATENCY: "Average latency",
  ERRORS: "Recent errors",
} as const;

interface HealthFactorVisual {
  Icon: NavIcon;
  labelKey: string;
  iconClass: string;
}

const DEFAULT_HEALTH_FACTOR_VISUAL: HealthFactorVisual = {
  Icon: GaugeIcon,
  labelKey: "nodeDetail.healthFactor",
  iconClass: "border-soc-accent/30 text-soc-accent",
};

const HEALTH_FACTOR_VISUALS: Record<string, HealthFactorVisual> = {
  [HEALTH_FACTOR.HEARTBEAT]: {
    Icon: HeartPulseIcon,
    labelKey: "nodeDetail.heartbeatHealth",
    iconClass: "border-soc-err/30 text-soc-err animate-pulse-soft",
  },
  [HEALTH_FACTOR.TASK_SUCCESS]: {
    Icon: CompletedTasksIcon,
    labelKey: "nodeDetail.taskSuccessHealth",
    iconClass: "border-soc-ok/30 text-soc-ok",
  },
  [HEALTH_FACTOR.LATENCY]: {
    Icon: GaugeIcon,
    labelKey: "nodeDetail.latencyHealth",
    iconClass: "border-soc-accent/30 text-soc-accent",
  },
  [HEALTH_FACTOR.ERRORS]: {
    Icon: FailedTasksIcon,
    labelKey: "nodeDetail.errorsHealth",
    iconClass: "border-soc-warn/30 text-soc-warn",
  },
};

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("nodeDetail.healthScore")}
          value={<HealthBadge score={node.health_score} />}
          Icon={HeartPulseIcon}
          iconClass="border-soc-brand/30 text-soc-brand"
        />
        <StatCard
          label={t("nodeDetail.totalTasks")}
          value={stats.total_tasks}
          Icon={MissionsIcon}
          iconClass="border-soc-accent/30 text-soc-accent"
        />
        <StatCard
          label={t("nodeDetail.successful")}
          value={stats.successful_tasks}
          accent="text-soc-ok"
          Icon={CompletedTasksIcon}
          iconClass="border-soc-ok/30 text-soc-ok"
        />
        <StatCard
          label={t("nodeDetail.failed")}
          value={stats.failed_tasks}
          accent="text-soc-err"
          Icon={FailedTasksIcon}
          iconClass="border-soc-err/30 text-soc-err"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="card h-full p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">{t("nodeDetail.healthBreakdown")}</h3>
        <div className="space-y-2">
          {health.factors.map((factor) => (
            <HealthFactorRow key={factor.label} factor={factor} />
          ))}
          </div>
        </div>

        <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
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
          <Select
            value={edit.policy_id ?? "basic_safe"}
            ariaLabel={t("nodes.policy")}
            options={policies.map((policy) => ({ value: policy.id, label: policy.name }))}
            onChange={(value) => setEdit((current) => ({ ...current, policy_id: value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          {t("nodeDetail.nodeType")}
          <Select
            value={edit.node_type ?? "real"}
            ariaLabel={t("nodeDetail.nodeType")}
            options={[
              { value: "real", label: t("nodeType.real") },
              { value: "simulated", label: t("nodeType.simulated") },
              { value: "ai_analyst", label: t("nodeType.ai_analyst_placeholder") },
            ]}
            onChange={(value) =>
              setEdit((current) => ({
                ...current,
                node_type: value as NodeUpdate["node_type"],
              }))
            }
          />
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
      </div>

      <div className="card grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-2 md:grid-cols-4">
        <Info label={t("nodes.os")} value={node.os} dash={t("common.dash")} Icon={DeviceIcon} />
        <Info
          label={t("nodeDetail.user")}
          value={node.username}
          dash={t("common.dash")}
          Icon={UserIcon}
        />
        <Info label={t("nodes.lastSeen")} value={timeAgo(node.last_seen)} Icon={ClockIcon} />
        <Info
          label={t("nodes.lastHeartbeat")}
          value={timeAgo(last_heartbeat)}
          Icon={HeartPulseIcon}
          iconClass="text-soc-err animate-pulse-soft"
        />
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

type HealthFactor = NodeDetail["health"]["factors"][number];

function HealthFactorRow({ factor }: { factor: HealthFactor }) {
  const { t } = useI18n();
  const visual = HEALTH_FACTOR_VISUALS[factor.label] ?? DEFAULT_HEALTH_FACTOR_VISUAL;
  const { Icon } = visual;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-soc-borderSubtle bg-soc-bg/40 p-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-soc-panel2/70 ${visual.iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm text-white">{t(visual.labelKey)}</span>
        <p className="text-xs text-soc-muted">{factor.detail}</p>
      </div>
      <span className="font-mono text-soc-accent">{factor.score}</span>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  Icon: NavIcon;
  iconClass: string;
  accent?: string;
}

function StatCard({ label, value, Icon, iconClass, accent }: StatCardProps) {
  return (
    <div className="card flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="text-xs uppercase text-soc-muted">{label}</div>
        <div className={`mt-2 text-2xl font-semibold ${accent ?? "text-white"}`}>{value}</div>
      </div>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-soc-bg/60 ${iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

interface InfoProps {
  label: string;
  value: string;
  Icon: NavIcon;
  dash?: string;
  iconClass?: string;
}

function Info({ label, value, Icon, dash, iconClass = "text-soc-accent" }: InfoProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-soc-borderSubtle bg-soc-bg/40 p-3">
      <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
      <div className="min-w-0">
        <div className="text-xs text-soc-muted">{label}</div>
        <div className="truncate text-white">{value || dash || "—"}</div>
      </div>
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
