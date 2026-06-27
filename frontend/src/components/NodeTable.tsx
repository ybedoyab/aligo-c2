import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { type Node, type NodePolicy, type PluginName } from "../types";
import { HealthBadge, NodeMetaBadges, StatusBadge } from "./HealthBadge";

function defaultArgs(plugin: PluginName): Record<string, unknown> {
  if (plugin === "echo") return { text: "ping" };
  if (plugin === "list_lab_directory") return { path: "." };
  if (plugin === "allowed_command") return { command: "whoami" };
  return {};
}

function QuickTask({
  node,
  policies,
}: {
  node: Node;
  policies: NodePolicy[];
}) {
  const { t, translateError } = useI18n();
  const policy = policies.find((p) => p.id === node.policy_id);
  const allowed = (policy?.plugins ?? ["health_check", "system_info", "echo"]) as PluginName[];
  const [plugin, setPlugin] = useState<PluginName>(allowed[0] ?? "health_check");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!allowed.includes(plugin)) setPlugin(allowed[0] ?? "health_check");
  }, [node.policy_id, allowed, plugin]);

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api.createTask({
        node_id: node.id,
        plugin,
        args: defaultArgs(plugin),
      });
      setMsg(t("common.sent"));
    } catch (e) {
      setMsg(translateError((e as Error).message));
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(""), 3500);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      <select
        className="input py-1 text-xs max-w-[140px]"
        value={plugin}
        onChange={(e) => setPlugin(e.target.value as PluginName)}
      >
        {allowed.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        className="btn-primary py-1 text-xs"
        onClick={run}
        disabled={busy || node.status === "offline" || !node.enabled}
      >
        {busy ? "…" : t("common.run")}
      </button>
      {msg && (
        <span
          className={`text-xs ${msg.includes(t("common.blockedByPolicy")) ? "text-soc-warn" : "text-soc-muted"}`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}

export function NodeTable({ nodes }: { nodes: Node[] }) {
  const { t, timeAgo } = useI18n();
  const [policies, setPolicies] = useState<NodePolicy[]>([]);
  useEffect(() => {
    api.listPolicies().then(setPolicies).catch(() => {});
  }, []);

  return (
    <div className="card-static overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-soc-muted border-b border-soc-border">
            <th className="px-4 py-3">{t("nodes.node")}</th>
            <th className="px-4 py-3">{t("nodes.status")}</th>
            <th className="px-4 py-3">{t("nodes.registry")}</th>
            <th className="px-4 py-3">{t("nodes.policy")}</th>
            <th className="px-4 py-3">{t("nodes.health")}</th>
            <th className="px-4 py-3">{t("nodes.os")}</th>
            <th className="px-4 py-3">{t("nodes.lastHeartbeat")}</th>
            <th className="px-4 py-3 text-right">{t("nodes.quickTask")}</th>
          </tr>
        </thead>
        <tbody>
          {nodes.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-soc-muted">
                {t("nodes.empty")}{" "}
                <code className="text-soc-accent">{t("nodes.emptyCli")}</code>
              </td>
            </tr>
          )}
          {nodes.map((node) => (
            <tr
              key={node.id}
              className="border-b border-soc-borderSubtle/60 last:border-0 row-hover"
            >
              <td className="px-4 py-3">
                <Link
                  to={`/nodes/${node.id}`}
                  className="font-mono text-white hover:text-soc-accent"
                >
                  {node.alias || node.id}
                </Link>
                <div className="text-xs text-soc-muted font-mono">{node.id}</div>
                <div className="text-xs text-soc-muted">{node.hostname}</div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={node.status} />
              </td>
              <td className="px-4 py-3">
                <NodeMetaBadges
                  enabled={node.enabled}
                  trusted={node.trusted}
                  nodeType={node.node_type}
                />
              </td>
              <td className="px-4 py-3 text-xs text-soc-muted font-mono">{node.policy_id}</td>
              <td className="px-4 py-3">
                <HealthBadge score={node.health_score} />
              </td>
              <td className="px-4 py-3 text-soc-muted">{node.os || t("common.dash")}</td>
              <td className="px-4 py-3 text-soc-muted">{timeAgo(node.last_seen)}</td>
              <td className="px-4 py-3">
                <QuickTask node={node} policies={policies} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
