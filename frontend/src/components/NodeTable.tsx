import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ALLOWED_PLUGINS, type Node, type PluginName } from "../types";
import { timeAgo } from "../utils";
import { HealthBadge, StatusBadge } from "./HealthBadge";

function defaultArgs(plugin: PluginName): Record<string, unknown> {
  if (plugin === "echo") return { text: "ping" };
  if (plugin === "list_lab_directory") return { path: "." };
  if (plugin === "allowed_command") return { command: "whoami" };
  return {};
}

function QuickTask({ node }: { node: Node }) {
  const [plugin, setPlugin] = useState<PluginName>("health_check");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api.createTask({
        node_id: node.id,
        plugin,
        args: defaultArgs(plugin),
      });
      setMsg("sent");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(""), 2500);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        className="input py-1 text-xs"
        value={plugin}
        onChange={(e) => setPlugin(e.target.value as PluginName)}
      >
        {ALLOWED_PLUGINS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        className="btn-primary py-1 text-xs"
        onClick={run}
        disabled={busy || node.status === "offline"}
      >
        {busy ? "…" : "Run"}
      </button>
      {msg && <span className="text-xs text-soc-muted">{msg}</span>}
    </div>
  );
}

export function NodeTable({ nodes }: { nodes: Node[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-soc-muted border-b border-soc-border">
            <th className="px-4 py-3">Node</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Health</th>
            <th className="px-4 py-3">OS</th>
            <th className="px-4 py-3">Last heartbeat</th>
            <th className="px-4 py-3 text-right">Quick task</th>
          </tr>
        </thead>
        <tbody>
          {nodes.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-soc-muted">
                No nodes yet. Start one with{" "}
                <code className="text-soc-accent">python node.py --node-id node-001</code>
              </td>
            </tr>
          )}
          {nodes.map((node) => (
            <tr
              key={node.id}
              className="border-b border-soc-border/50 last:border-0 hover:bg-soc-panel2/50"
            >
              <td className="px-4 py-3">
                <Link
                  to={`/nodes/${node.id}`}
                  className="font-mono text-white hover:text-soc-accent"
                  onClick={(e) => e.stopPropagation()}
                >
                  {node.id}
                </Link>
                <div className="text-xs text-soc-muted">{node.hostname}</div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={node.status} />
              </td>
              <td className="px-4 py-3">
                <HealthBadge score={node.health_score} />
              </td>
              <td className="px-4 py-3 text-soc-muted">{node.os || "-"}</td>
              <td className="px-4 py-3 text-soc-muted">{timeAgo(node.last_seen)}</td>
              <td className="px-4 py-3">
                <QuickTask node={node} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
