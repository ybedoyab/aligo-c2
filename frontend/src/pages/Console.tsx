import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useC2 } from "../store";
import {
  ALLOWED_PLUGINS,
  type ConsoleHistoryEntry,
  type PluginName,
  type TaskStatus,
} from "../types";
import { formatTime } from "../utils";
import { StatusBadge } from "../components/HealthBadge";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";

const DEFAULT_ARGS: Record<PluginName, string> = {
  system_info: "{}",
  health_check: "{}",
  echo: '{"text": "ping"}',
  list_lab_directory: '{"path": "."}',
  network_info: "{}",
  allowed_command: '{"command": "whoami"}',
};

function parseConsoleCommand(
  line: string
): { ok: true; action: string; payload?: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, error: "empty command" };

  const verifyMatch = /^verify\s+task\s+(\S+)$/i.exec(trimmed);
  if (verifyMatch) {
    return { ok: true, action: "verify_task", payload: { task_id: verifyMatch[1] } };
  }

  const replayMatch = /^replay\s+mission\s+(\S+)$/i.exec(trimmed);
  if (replayMatch) {
    return { ok: true, action: "replay_mission", payload: { mission_id: replayMatch[1] } };
  }

  const runMatch = /^run\s+(\w+)\s+on\s+(all|\S+)$/i.exec(trimmed);
  if (runMatch) {
    const plugin = runMatch[1].toLowerCase();
    if (!ALLOWED_PLUGINS.includes(plugin as PluginName)) {
      return {
        ok: false,
        error: `unknown plugin '${plugin}'. Allowed: ${ALLOWED_PLUGINS.join(", ")}`,
      };
    }
    return {
      ok: true,
      action: "run_plugin",
      payload: { plugin, target: runMatch[2].toLowerCase() },
    };
  }

  return {
    ok: false,
    error:
      "Unknown command. Try: run health_check on node-001 | run system_info on all | verify task <id> | replay mission <id>",
  };
}

export function Console() {
  const { nodes, tasks, refreshAll } = useC2();
  const [target, setTarget] = useState<string>("all");
  const [plugin, setPlugin] = useState<PluginName>("health_check");
  const [argsText, setArgsText] = useState(DEFAULT_ARGS.health_check);
  const [history, setHistory] = useState<ConsoleHistoryEntry[]>([]);
  const [cmdLine, setCmdLine] = useState("");
  const [cmdMsg, setCmdMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  const onlineNodes = nodes.filter((a) => a.status === "online");

  const dispatchPlugin = useCallback(
    async (pluginName: PluginName, args: Record<string, unknown>, targetIds: string[]) => {
      if (targetIds.length === 0) {
        throw new Error("no target nodes online");
      }
      for (const nodeId of targetIds) {
        const entryId = `${Date.now()}-${nodeId}`;
        setHistory((h) => [
          {
            id: entryId,
            timestamp: new Date().toISOString(),
            target: nodeId,
            plugin: pluginName,
            task_id: "…",
            status: "dispatching",
          },
          ...h,
        ]);
        const task = await api.createTask({
          node_id: nodeId,
          plugin: pluginName,
          args,
        });
        setHistory((h) =>
          h.map((row) =>
            row.id === entryId
              ? { ...row, task_id: task.id, status: task.status as TaskStatus }
              : row
          )
        );
      }
      refreshAll();
    },
    [refreshAll]
  );

  const runForm = async () => {
    setBusy(true);
    setCmdMsg("");
    try {
      const args = JSON.parse(argsText) as Record<string, unknown>;
      const targets =
        target === "all" ? onlineNodes.map((a) => a.id) : [target];
      await dispatchPlugin(plugin, args, targets);
      setCmdMsg(`Dispatched ${plugin} to ${targets.length} node(s).`);
    } catch (e) {
      setCmdMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runCmdLine = async () => {
    const parsed = parseConsoleCommand(cmdLine);
    if (!parsed.ok) {
      setCmdMsg(parsed.error);
      return;
    }
    setBusy(true);
    setCmdMsg("");
    try {
      if (parsed.action === "run_plugin") {
        const pluginName = parsed.payload!.plugin as PluginName;
        const tgt = parsed.payload!.target as string;
        const args = JSON.parse(DEFAULT_ARGS[pluginName]) as Record<string, unknown>;
        const targets =
          tgt === "all" ? onlineNodes.map((a) => a.id) : [tgt];
        await dispatchPlugin(pluginName, args, targets);
        setCmdMsg(`Ran ${pluginName} on ${targets.join(", ")}`);
      } else if (parsed.action === "verify_task") {
        const taskId = parsed.payload!.task_id as string;
        const ev = await api.getTaskEvidence(taskId);
        if (ev.ledger_event_id) {
          const v = await api.verifyLedgerEvent(ev.ledger_event_id);
          setCmdMsg(`Verify ${taskId}: ${v.status} — ${v.detail}`);
        } else {
          setCmdMsg(`Task ${taskId} has no ledger event yet.`);
        }
      } else if (parsed.action === "replay_mission") {
        const missionId = parsed.payload!.mission_id as string;
        const missionTasks = tasks.filter((t) => t.mission_id === missionId);
        setCmdMsg(
          `Mission ${missionId}: ${missionTasks.length} task(s) in history. Open Dashboard for timeline replay.`
        );
      }
      setCmdLine("");
    } catch (e) {
      setCmdMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setHistory((h) =>
      h.map((row) => {
        const t = tasks.find((x) => x.id === row.task_id);
        if (!t || row.status === "dispatching") return row;
        return { ...row, status: t.status };
      })
    );
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Operator Console</h1>
        <p className="text-sm text-soc-muted">
          Safe, plugin-based operator interface — not a remote shell. Commands map to
          allowlisted plugins only.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-soc-muted">
            Target
            <select
              className="input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="all">All online nodes ({onlineNodes.length})</option>
              {nodes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} ({a.status})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-soc-muted">
            Plugin
            <select
              className="input"
              value={plugin}
              onChange={(e) => {
                const p = e.target.value as PluginName;
                setPlugin(p);
                setArgsText(DEFAULT_ARGS[p]);
              }}
            >
              {ALLOWED_PLUGINS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={runForm} disabled={busy}>
              {busy ? "Running…" : "Run"}
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          Arguments (JSON)
          <textarea
            className="input font-mono text-xs min-h-[80px]"
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
          />
        </label>
      </div>

      <div className="card p-4">
        <div className="text-xs text-soc-muted mb-2">Terminal-style commands</div>
        <div className="flex gap-2">
          <input
            className="input flex-1 font-mono text-sm"
            placeholder="run health_check on node-001"
            value={cmdLine}
            onChange={(e) => setCmdLine(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCmdLine()}
          />
          <button className="btn-ghost" onClick={runCmdLine} disabled={busy}>
            Execute
          </button>
        </div>
        {cmdMsg && <div className="mt-2 text-xs text-soc-muted">{cmdMsg}</div>}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-soc-border text-sm font-semibold text-white">
          Command history
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-soc-muted border-b border-soc-border">
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Plugin</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-soc-muted">
                  No commands yet.
                </td>
              </tr>
            )}
            {history.map((row) => (
              <tr key={row.id} className="border-b border-soc-border/40">
                <td className="px-4 py-2 text-xs text-soc-muted">
                  {formatTime(row.timestamp)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.target}</td>
                <td className="px-4 py-2 font-mono text-xs text-soc-accent">
                  {row.plugin}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {row.task_id !== "…" && (
                    <button
                      className="btn-ghost py-0.5 text-xs"
                      onClick={() => setEvidenceTaskId(row.task_id)}
                    >
                      View evidence
                    </button>
                  )}
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
