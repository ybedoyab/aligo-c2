import { useState } from "react";
import { api } from "../api/client";
import { TimelineReplay } from "../components/TimelineReplay";
import { useC2 } from "../store";

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
      className="card p-6 text-left hover:border-soc-accent transition-colors disabled:opacity-50"
    >
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="text-sm text-soc-muted mt-1">{subtitle}</div>
    </button>
  );
}

export function Demo() {
  const { ledger, agents, refreshAll } = useC2();
  const [log, setLog] = useState<string[]>([]);
  const [showReplay, setShowReplay] = useState(false);

  const append = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 30));

  const startSample = async () => {
    try {
      const res = await api.startSampleMission();
      append(`Started "${res.mission.name}" on ${res.targets.length} agent(s).`);
      refreshAll();
    } catch (e) {
      append(`Error: ${(e as Error).message}`);
    }
  };

  const runHealthCheck = async () => {
    const online = agents.filter((a) => a.status === "online");
    if (online.length === 0) {
      append("No agents online. Start agents first.");
      return;
    }
    try {
      for (const a of online) {
        await api.createTask({ agent_id: a.id, plugin: "health_check", args: {} });
      }
      append(`Health check dispatched to ${online.length} agent(s).`);
    } catch (e) {
      append(`Error: ${(e as Error).message}`);
    }
  };

  const verifyLatest = async () => {
    if (ledger.length === 0) {
      append("No ledger events to verify yet.");
      return;
    }
    try {
      const latest = ledger[0];
      const result = await api.verifyLedgerEvent(latest.id);
      append(`Verify ${latest.event_type}: ${result.status.toUpperCase()} — ${result.detail}`);
    } catch (e) {
      append(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Demo Control</h1>
        <p className="text-sm text-soc-muted">
          One-click flow for the jury: connect agents, run a mission, verify integrity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigButton
          title="1 · Start sample mission"
          subtitle="Run Lab Health Check across all connected agents"
          onClick={startSample}
        />
        <div className="card p-6">
          <div className="text-lg font-semibold text-white">2 · Connect agents</div>
          <div className="text-sm text-soc-muted mt-1">
            Launch simulated agents from a terminal:
          </div>
          <code className="mt-2 block bg-soc-bg border border-soc-border rounded-lg p-2 text-xs text-soc-accent">
            python agent.py --simulate-count 3
          </code>
        </div>
        <BigButton
          title="3 · Run health check"
          subtitle="Send a health_check task to every online agent"
          onClick={runHealthCheck}
        />
        <BigButton
          title="4 · Verify ledger"
          subtitle="Verify the most recent ledger event end-to-end"
          onClick={verifyLatest}
        />
        <BigButton
          title="5 · Show replay"
          subtitle="Animate the timeline of the operation"
          onClick={() => setShowReplay((s) => !s)}
        />
      </div>

      {showReplay && <TimelineReplay events={ledger} />}

      <div className="card p-4">
        <div className="text-sm font-semibold text-white mb-2">Activity log</div>
        {log.length === 0 ? (
          <div className="text-sm text-soc-muted">Actions you trigger will appear here.</div>
        ) : (
          <ul className="space-y-1 font-mono text-xs text-soc-muted">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
