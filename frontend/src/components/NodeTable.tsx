import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { type Node, type NodePolicy, type PluginName } from "../types";
import { HealthBadge, NodeMetaBadges, StatusBadge } from "./HealthBadge";
import { DeviceIcon, PlayIcon } from "./icons";
import { Select } from "./Select";

const NODE_ROUTE = "/nodes";
const MESSAGE_TIMEOUT_MS = 3500;
const DEFAULT_PLUGIN: PluginName = "health_check";
const DEFAULT_ALLOWED_PLUGINS: PluginName[] = ["health_check", "system_info", "echo"];
const DEFAULT_PLUGIN_ARGS: Partial<Record<PluginName, Record<string, unknown>>> = {
  echo: { text: "ping" },
  list_lab_directory: { path: "." },
  allowed_command: { command: "whoami" },
};

function QuickTask({ node, policies }: { node: Node; policies: NodePolicy[] }) {
  const { t, translateError } = useI18n();
  const allowed = useMemo(() => {
    const policy = policies.find((item) => item.id === node.policy_id);
    return (policy?.plugins ?? DEFAULT_ALLOWED_PLUGINS) as PluginName[];
  }, [node.policy_id, policies]);
  const [plugin, setPlugin] = useState<PluginName>(allowed[0] ?? DEFAULT_PLUGIN);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!allowed.includes(plugin)) setPlugin(allowed[0] ?? DEFAULT_PLUGIN);
  }, [allowed, plugin]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), MESSAGE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const run = async () => {
    setBusy(true);
    setMessage("");

    try {
      await api.createTask({
        node_id: node.id,
        plugin,
        args: DEFAULT_PLUGIN_ARGS[plugin] ?? {},
      });
      setMessage(t("common.sent"));
    } catch (error) {
      setMessage(translateError((error as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const messageClass = message.includes(t("common.blockedByPolicy"))
    ? "text-soc-warn"
    : "text-soc-muted";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select
        className="w-full max-w-[140px]"
        buttonClassName="py-1 text-xs"
        value={plugin}
        ariaLabel={t("nodes.quickTaskPlugin")}
        options={allowed.map((item) => ({ value: item, label: item }))}
        onChange={(value) => setPlugin(value as PluginName)}
      />
      <button
        type="button"
        className="btn-primary py-1 text-xs"
        onClick={() => void run()}
        disabled={busy || node.status === "offline" || !node.enabled}
      >
        <PlayIcon className="h-3.5 w-3.5" />
        {busy ? t("common.working") : t("common.run")}
      </button>
      {message ? <span className={`text-xs ${messageClass}`}>{message}</span> : null}
    </div>
  );
}

export function NodeTable({ nodes }: { nodes: Node[] }) {
  const { t, timeAgo } = useI18n();
  const [policies, setPolicies] = useState<NodePolicy[]>([]);

  useEffect(() => {
    api.listPolicies().then(setPolicies).catch(() => setPolicies([]));
  }, []);

  return (
    <section className="card-static hidden overflow-hidden xl:block">
      <div className="flex items-center gap-3 border-b border-soc-borderSubtle px-4 py-3">
        <DeviceIcon className="h-5 w-5 text-soc-accent" />
        <div>
          <h2 className="text-sm font-semibold text-white">{t("nodes.tableTitle")}</h2>
          <p className="text-xs text-soc-muted">{t("nodes.tableDescription")}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-sm">
          <thead>
            <tr className="border-b border-soc-border text-left text-xs uppercase tracking-wide text-soc-muted">
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
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-soc-muted">
                  {t("nodes.empty")} {" "}
                  <code className="text-soc-accent">{t("nodes.emptyCli")}</code>
                </td>
              </tr>
            ) : null}
            {nodes.map((node) => (
              <tr
                key={node.id}
                className="row-hover animate-fade-in border-b border-soc-borderSubtle/60 last:border-0"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`${NODE_ROUTE}/${node.id}`}
                    className="font-mono text-white hover:text-soc-accent"
                  >
                    {node.alias || node.id}
                  </Link>
                  <div className="font-mono text-xs text-soc-muted">{node.id}</div>
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
                <td className="px-4 py-3 font-mono text-xs text-soc-muted">
                  {node.policy_id}
                </td>
                <td className="px-4 py-3">
                  <HealthBadge score={node.health_score} />
                </td>
                <td className="px-4 py-3 text-soc-muted">
                  {node.os || t("common.dash")}
                </td>
                <td className="px-4 py-3 text-soc-muted">{timeAgo(node.last_seen)}</td>
                <td className="px-4 py-3">
                  <QuickTask node={node} policies={policies} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
