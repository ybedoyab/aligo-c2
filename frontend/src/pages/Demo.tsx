import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { TimelineReplay } from "../components/TimelineReplay";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";
import { IntegrityBadge } from "../components/HealthBadge";
import { useC2 } from "../store";
import { downloadMissionReport } from "../utils/missionReport";

function BigButton({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card p-6 text-left hover:border-soc-accent transition-colors disabled:opacity-50 w-full"
    >
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="text-sm text-soc-muted mt-1">{subtitle}</div>
    </button>
  );
}

export function Demo() {
  const { ledger, nodes, missions, tasks, results, refreshAll } = useC2();
  const [log, setLog] = useState<string[]>([]);
  const [showReplay, setShowReplay] = useState(false);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const append = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 40));

  const onlineCount = nodes.filter((a) => a.status === "online").length;
  const anchored = ledger.filter(
    (e) => e.onchain_status === "anchored" || e.onchain_status === "confirmed"
  ).length;

  const jurySteps = useMemo(
    () => [
      {
        n: 1,
        label: "Nodes connected",
        done: onlineCount > 0,
        detail: `${onlineCount} online`,
      },
      {
        n: 2,
        label: "Mission created",
        done: missions.some((m) => m.status !== "draft"),
        detail: `${missions.length} in library`,
      },
      {
        n: 3,
        label: "Tasks executed",
        done: tasks.some((t) => t.status === "success"),
        detail: `${tasks.filter((t) => t.status === "success").length} succeeded`,
      },
      {
        n: 4,
        label: "Results received",
        done: results.length > 0,
        detail: `${results.length} results`,
      },
      {
        n: 5,
        label: "Evidence on ledger",
        done: ledger.some((e) =>
          ["TASK_RESULT", "TASK_SENT"].includes(e.event_type)
        ),
        detail: `${anchored} anchored · ${ledger.length} events`,
      },
    ],
    [onlineCount, missions, tasks, results, ledger, anchored]
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const startSample = () =>
    run(async () => {
      const res = await api.startSampleMission();
      append(`✓ Started "${res.mission.name}" on ${res.targets.join(", ")}`);
    }).catch((e) => append(`✗ ${(e as Error).message}`));

  const runHealthCheck = () =>
    run(async () => {
      const online = nodes.filter((a) => a.status === "online");
      if (!online.length) throw new Error("no nodes online");
      for (const a of online) {
        await api.createTask({ node_id: a.id, plugin: "health_check", args: {} });
      }
      append(`✓ health_check → ${online.map((a) => a.id).join(", ")}`);
    }).catch((e) => append(`✗ ${(e as Error).message}`));

  const anchorPending = () =>
    run(async () => {
      const res = await api.anchorPendingLedger();
      const ok = res.filter((r) => r.success).length;
      append(`✓ Anchored ${ok}/${res.length} pending ledger event(s)`);
    }).catch((e) => append(`✗ ${(e as Error).message}`));

  const verifyLatest = () =>
    run(async () => {
      const taskEvent = ledger.find((e) => e.event_type === "TASK_RESULT");
      const target = taskEvent ?? ledger[0];
      if (!target) throw new Error("no ledger events yet");
      const v = await api.verifyLedgerEvent(target.id);
      append(`✓ Verify ${target.event_type}: ${v.status} — ${v.detail}`);
    }).catch((e) => append(`✗ ${(e as Error).message}`));

  const openLatestEvidence = () => {
    const latest = results[0];
    if (!latest) {
      append("✗ No results yet — run a mission first");
      return;
    }
    setEvidenceTaskId(latest.task_id);
    append(`✓ Opened evidence for ${latest.task_id}`);
  };

  const exportSampleReport = (format: "json" | "markdown") => {
    const mission = missions.find((m) => m.is_predefined) ?? missions[0];
    if (!mission) {
      append("✗ No missions available");
      return;
    }
    run(async () => {
      await downloadMissionReport(mission.id, format);
      append(`✓ Exported ${format} report for "${mission.name}"`);
    }).catch((e) => append(`✗ ${(e as Error).message}`));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Demo Control</h1>
        <p className="text-sm text-soc-muted">
          Jury-ready one-click demo: missions, health checks, ledger anchoring, and
          integrity verification.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Jury mode — 5-step story</h2>
        <ol className="space-y-2">
          {jurySteps.map((s) => (
            <li
              key={s.n}
              className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm ${
                s.done
                  ? "border-soc-ok/40 bg-soc-ok/5"
                  : "border-soc-border bg-soc-panel2/30"
              }`}
            >
              <span className="text-white">
                {s.done ? "✓" : "○"} {s.n}. {s.label}
              </span>
              <span className="text-xs text-soc-muted">{s.detail}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-5 border-amber-500/20 bg-amber-500/5">
        <h2 className="text-sm font-semibold text-white mb-2">Simulated IoT mode</h2>
        <p className="text-xs text-soc-muted mb-4">
          Simulated IoT mode demonstrates how Mission Ledger C2 can orchestrate gateways,
          sensors, and actuators without requiring physical hardware. Actions are executed
          through a connected software gateway and recorded as verifiable evidence.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <BigButton
            title="Start IoT Lab Health Check"
            subtitle="gateway_health · list_devices · snapshot"
            onClick={() =>
              run(async () => {
                const res = await api.startIoTHealthCheck();
                append(`✓ IoT health check on ${res.targets.join(", ")}`);
              }).catch((e) => append(`✗ ${(e as Error).message}`))
            }
            disabled={busy}
          />
          <BigButton
            title="Run Environmental Snapshot"
            subtitle="Read all four simulated sensors"
            onClick={() =>
              run(async () => {
                const res = await api.runEnvironmentalSnapshot();
                append(`✓ Environmental snapshot (${res.tasks.length} tasks)`);
              }).catch((e) => append(`✗ ${(e as Error).message}`))
            }
            disabled={busy}
          />
          <BigButton
            title="Blink simulated LED"
            subtitle="led_blink on led-001 via gateway"
            onClick={() =>
              run(async () => {
                const res = await api.blinkLed();
                append(`✓ LED blink task ${res.task.id}`);
              }).catch((e) => append(`✗ ${(e as Error).message}`))
            }
            disabled={busy}
          />
          <Link to="/iot-lab" className="card p-6 hover:border-soc-accent transition-colors block">
            <div className="text-lg font-semibold text-white">Open IoT Lab</div>
            <div className="text-sm text-soc-muted mt-1">Live circuit, telemetry, and device cards</div>
          </Link>
          <BigButton
            title="Verify latest IoT event"
            subtitle="Integrity check on newest gateway task result"
            onClick={() =>
              run(async () => {
                const v = await api.verifyLatestIoTEvent();
                append(`✓ IoT verify ${v.plugin}: ${v.verify_status}`);
              }).catch((e) => append(`✗ ${(e as Error).message}`))
            }
            disabled={busy}
          />
          <BigButton
            title="Export IoT evidence bundle"
            subtitle="Download recent IoT task evidence JSON"
            onClick={() =>
              run(async () => {
                const bundle = await api.exportIoTEvidence();
                const blob = new Blob([JSON.stringify(bundle, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "iot-evidence-bundle.json";
                a.click();
                URL.revokeObjectURL(url);
                append(`✓ Exported ${bundle.count} IoT evidence record(s)`);
              }).catch((e) => append(`✗ ${(e as Error).message}`))
            }
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigButton
          title="Start sample mission"
          subtitle="Lab Health Check on all connected nodes"
          onClick={startSample}
          disabled={busy}
        />
        <BigButton
          title="Run health check on all"
          subtitle="Dispatch health_check plugin to every online node"
          onClick={runHealthCheck}
          disabled={busy}
        />
        <BigButton
          title="Anchor pending ledger events"
          subtitle="Push pending_chain events to the blockchain"
          onClick={anchorPending}
          disabled={busy}
        />
        <BigButton
          title="Verify latest ledger event"
          subtitle="Compare local hash vs on-chain record"
          onClick={verifyLatest}
          disabled={busy}
        />
        <BigButton
          title="Show replay"
          subtitle="Animate the operation timeline"
          onClick={() => {
            setShowReplay((s) => !s);
            append(showReplay ? "Timeline replay hidden" : "Timeline replay shown");
          }}
        />
        <BigButton
          title="Export mission report (JSON)"
          subtitle="Download mission evidence bundle for jury handoff"
          onClick={() => exportSampleReport("json")}
          disabled={busy}
        />
        <BigButton
          title="Export mission report (Markdown)"
          subtitle="Human-readable mission summary with ledger hashes"
          onClick={() => exportSampleReport("markdown")}
          disabled={busy}
        />
        <BigButton
          title="Simulate tamper (demo)"
          subtitle="Controlled lab demo — mutates local ledger copy; Verify shows TAMPERED"
          onClick={() =>
            run(async () => {
              const latest = results.find((r) => r.status === "success");
              if (!latest) throw new Error("run a successful task first");
              const r = await api.simulateTamper(latest.task_id);
              append(`✓ Tamper demo on ${r.task_id}: verify=${r.verify_status}`);
            }).catch((e) => append(`✗ ${(e as Error).message}`))
          }
          disabled={busy}
        />
        <BigButton
          title="Open latest task evidence"
          subtitle="Task Execution Evidence modal for the newest result"
          onClick={openLatestEvidence}
          disabled={busy}
        />
      </div>

      <div className="card p-4 text-xs text-soc-muted">
        <span className="text-white font-medium">Connect nodes:</span>{" "}
        <code className="text-soc-accent">python node.py --simulate-count 3</code>
        {" · "}
        <span className="text-white font-medium">Deploy contract:</span> set{" "}
        <code className="text-soc-accent">CONTRACT_ADDRESS</code> in .env
      </div>

      {showReplay && (
        <TimelineReplay events={ledger} missions={missions} tasks={tasks} />
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-white">Activity log</div>
          <IntegrityBadge
            status={
              anchored > 0 ? "anchored" : ledger.length ? "pending_chain" : "unknown"
            }
          />
        </div>
        {log.length === 0 ? (
          <div className="text-sm text-soc-muted">
            Click a demo button — each action logs here.
          </div>
        ) : (
          <ul className="space-y-1 font-mono text-xs text-soc-muted max-h-48 overflow-y-auto">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <TaskEvidenceModal
        taskId={evidenceTaskId}
        onClose={() => setEvidenceTaskId(null)}
      />
    </div>
  );
}
