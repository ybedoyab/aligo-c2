import { useState } from "react";
import { api } from "../api/client";
import { ALLOWED_PLUGINS, type Agent, type PluginName } from "../types";
import { timeAgo } from "../utils";
import { HealthBadge, StatusBadge } from "./HealthBadge";

function defaultArgs(plugin: PluginName): Record<string, unknown> {
  if (plugin === "echo") return { text: "ping" };
  if (plugin === "list_lab_directory") return { path: "." };
  if (plugin === "allowed_command") return { command: "whoami" };
  return {};
}

function QuickTask({ agent }: { agent: Agent }) {
  const [plugin, setPlugin] = useState<PluginName>("health_check");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api.createTask({
        agent_id: agent.id,
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
        disabled={busy || agent.status === "offline"}
      >
        {busy ? "…" : "Run"}
      </button>
      {msg && <span className="text-xs text-soc-muted">{msg}</span>}
    </div>
  );
}

export function AgentTable({ agents }: { agents: Agent[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-soc-muted border-b border-soc-border">
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Health</th>
            <th className="px-4 py-3">OS</th>
            <th className="px-4 py-3">Last heartbeat</th>
            <th className="px-4 py-3 text-right">Quick task</th>
          </tr>
        </thead>
        <tbody>
          {agents.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-soc-muted">
                No agents yet. Start one with{" "}
                <code className="text-soc-accent">python agent.py --agent-id agent-001</code>
              </td>
            </tr>
          )}
          {agents.map((agent) => (
            <tr
              key={agent.id}
              className="border-b border-soc-border/50 last:border-0 hover:bg-soc-panel2/50"
            >
              <td className="px-4 py-3">
                <div className="font-mono text-white">{agent.id}</div>
                <div className="text-xs text-soc-muted">{agent.hostname}</div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={agent.status} />
              </td>
              <td className="px-4 py-3">
                <HealthBadge score={agent.health_score} />
              </td>
              <td className="px-4 py-3 text-soc-muted">{agent.os || "-"}</td>
              <td className="px-4 py-3 text-soc-muted">{timeAgo(agent.last_seen)}</td>
              <td className="px-4 py-3">
                <QuickTask agent={agent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
