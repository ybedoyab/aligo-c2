import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import {
  ALLOWED_PLUGINS,
  type ConsoleHistoryEntry,
  type PluginName,
  type TaskStatus,
} from "../types";
import { StatusBadge } from "../components/HealthBadge";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";

const DEFAULT_ARGS: Partial<Record<PluginName, string>> = {
  system_info: "{}",
  health_check: "{}",
  echo: '{"text": "ping"}',
  list_lab_directory: '{"path": "."}',
  network_info: "{}",
  allowed_command: '{"command": "whoami"}',
  gateway_health: "{}",
  list_devices: "{}",
  get_gateway_snapshot: "{}",
  read_temperature: '{"device_id": "temp-001"}',
  read_humidity: '{"device_id": "humidity-001"}',
  read_motion: '{"device_id": "motion-001"}',
  read_light: '{"device_id": "light-001"}',
  led_on: '{"device_id": "led-001"}',
  led_off: '{"device_id": "led-001"}',
  led_blink: '{"device_id": "led-001", "duration_ms": 2000, "interval_ms": 250}',
  led_set_brightness: '{"device_id": "led-001", "brightness": 50}',
};

function parseConsoleCommand(
  line: string,
  t: (key: string, params?: Record<string, string | number>) => string
): { ok: true; action: string; payload?: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, error: t("errors.emptyCommand") };

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
        error: t("errors.unknownPlugin", {
          plugin,
          allowed: ALLOWED_PLUGINS.join(", "),
        }),
      };
    }
    return {
      ok: true,
      action: "run_plugin",
      payload: { plugin, target: runMatch[2].toLowerCase() },
    };
  }

  return { ok: false, error: t("errors.unknownCommand") };
}

export function Console() {
  const { t, formatTime, status, translateError } = useI18n();
  const { nodes, tasks, refreshAll } = useC2();
  const [target, setTarget] = useState<string>("all");
  const [plugin, setPlugin] = useState<PluginName>("health_check");
  const [argsText, setArgsText] = useState(DEFAULT_ARGS.health_check ?? "{}");
  const [history, setHistory] = useState<ConsoleHistoryEntry[]>([]);
  const [cmdLine, setCmdLine] = useState("");
  const [cmdMsg, setCmdMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  const onlineNodes = nodes.filter((a) => a.status === "online");

  const dispatchPlugin = useCallback(
    async (pluginName: PluginName, args: Record<string, unknown>, targetIds: string[]) => {
      if (targetIds.length === 0) {
        throw new Error(t("errors.noTargetNodesOnline"));
      }
      try {
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
          try {
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
          } catch (e) {
            const msg = (e as Error).message;
            if (msg.startsWith("403:")) {
              setHistory((h) =>
                h.map((row) =>
                  row.id === entryId
                    ? { ...row, status: "blocked_by_policy" as TaskStatus }
                    : row
                )
              );
            }
            throw e;
          }
        }
        refreshAll();
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.startsWith("403:")) refreshAll();
        throw e;
      }
    },
    [refreshAll, t]
  );

  const runForm = async () => {
    setBusy(true);
    setCmdMsg("");
    try {
      const args = JSON.parse(argsText) as Record<string, unknown>;
      const targets = target === "all" ? onlineNodes.map((a) => a.id) : [target];
      await dispatchPlugin(plugin, args, targets);
      setCmdMsg(t("console.dispatched", { plugin, count: targets.length }));
    } catch (e) {
      setCmdMsg(translateError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const runCmdLine = async () => {
    const parsed = parseConsoleCommand(cmdLine, t);
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
        const args = JSON.parse(DEFAULT_ARGS[pluginName] ?? "{}") as Record<string, unknown>;
        const targets = tgt === "all" ? onlineNodes.map((a) => a.id) : [tgt];
        await dispatchPlugin(pluginName, args, targets);
        setCmdMsg(t("console.ranOn", { plugin: pluginName, targets: targets.join(", ") }));
      } else if (parsed.action === "verify_task") {
        const taskId = parsed.payload!.task_id as string;
        const ev = await api.getTaskEvidence(taskId);
        if (ev.ledger_event_id) {
          const v = await api.verifyLedgerEvent(ev.ledger_event_id);
          setCmdMsg(
            t("console.verifyResult", {
              taskId,
              status: status(v.status),
              detail: v.detail,
            })
          );
        } else {
          setCmdMsg(t("console.noLedgerEvent", { taskId }));
        }
      } else if (parsed.action === "replay_mission") {
        const missionId = parsed.payload!.mission_id as string;
        const missionTasks = tasks.filter((task) => task.mission_id === missionId);
        setCmdMsg(
          t("console.replayMission", { missionId, count: missionTasks.length })
        );
      }
      setCmdLine("");
    } catch (e) {
      setCmdMsg(translateError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setHistory((h) =>
      h.map((row) => {
        const task = tasks.find((x) => x.id === row.task_id);
        if (!task || row.status === "dispatching") return row;
        return { ...row, status: task.status };
      })
    );
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("console.title")}</h1>
        <p className="text-sm text-soc-muted">{t("console.description")}</p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-soc-muted">
            {t("console.target")}
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="all">
                {t("console.allOnline", { count: onlineNodes.length })}
              </option>
              {nodes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} ({status(a.status)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-soc-muted">
            {t("console.plugin")}
            <select
              className="input"
              value={plugin}
              onChange={(e) => {
                const p = e.target.value as PluginName;
                setPlugin(p);
                setArgsText(DEFAULT_ARGS[p] ?? "{}");
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
              {busy ? t("common.running") : t("common.run")}
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          {t("console.argumentsJson")}
          <textarea
            className="input font-mono text-xs min-h-[80px]"
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
          />
        </label>
      </div>

      <div className="card p-4">
        <div className="text-xs text-soc-muted mb-2">{t("console.terminalCommands")}</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1 font-mono text-sm min-w-0"
            placeholder={t("console.placeholder")}
            value={cmdLine}
            onChange={(e) => setCmdLine(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCmdLine()}
          />
          <button className="btn-ghost shrink-0" onClick={runCmdLine} disabled={busy}>
            {t("common.execute")}
          </button>
        </div>
        {cmdMsg && <div className="mt-2 text-xs text-soc-muted">{cmdMsg}</div>}
      </div>

      <div className="card-static overflow-hidden">
        <div className="panel-header">
          {t("console.commandHistory")}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs uppercase text-soc-muted border-b border-soc-border">
              <th className="px-4 py-2">{t("console.time")}</th>
              <th className="px-4 py-2">{t("console.target")}</th>
              <th className="px-4 py-2">{t("console.plugin")}</th>
              <th className="px-4 py-2">{t("taskConsole.status")}</th>
              <th className="px-4 py-2 text-right">{t("console.result")}</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-soc-muted">
                  {t("console.noCommands")}
                </td>
              </tr>
            )}
            {history.map((row) => (
              <tr key={row.id} className="border-b border-soc-borderSubtle/60 row-hover">
                <td className="px-4 py-2 text-xs text-soc-muted">
                  {formatTime(row.timestamp)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.target}</td>
                <td className="px-4 py-2 font-mono text-xs text-soc-accent">{row.plugin}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {row.task_id !== "…" && (
                    <button
                      className="btn-ghost py-0.5 text-xs"
                      onClick={() => setEvidenceTaskId(row.task_id)}
                    >
                      {t("common.viewEvidence")}
                    </button>
                  )}
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
