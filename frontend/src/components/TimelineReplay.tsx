import { useEffect, useMemo, useState } from "react";
import type { EventType, LedgerEvent, Mission, Task } from "../types";
import { formatTime, shortHash } from "../utils";
import { IntegrityBadge } from "./HealthBadge";

const EVENT_META: Record<EventType, { label: string; dot: string }> = {
  NODE_REGISTERED: { label: "Node connected", dot: "bg-soc-ok" },
  NODE_RECONNECTED: { label: "Node reconnected", dot: "bg-soc-ok" },
  NODE_DISCONNECTED: { label: "Node disconnected", dot: "bg-soc-err" },
  MISSION_CREATED: { label: "Mission created", dot: "bg-soc-accent2" },
  MISSION_STARTED: { label: "Mission started", dot: "bg-soc-accent" },
  TASK_SENT: { label: "Task sent", dot: "bg-soc-accent" },
  TASK_RESULT: { label: "Result received", dot: "bg-soc-ok" },
  TASK_FAILED: { label: "Task failed", dot: "bg-soc-err" },
  MISSION_COMPLETED: { label: "Mission completed", dot: "bg-soc-ok" },
};

function isAnchored(status: string) {
  return status === "confirmed" || status === "anchored";
}

export function TimelineReplay({
  events,
  missions = [],
  tasks = [],
}: {
  events: LedgerEvent[];
  missions?: Mission[];
  tasks?: Task[];
}) {
  const ordered = useMemo(
    () =>
      [...events].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).slice(-40),
    [events]
  );

  const [visible, setVisible] = useState(ordered.length);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) {
      setVisible(ordered.length);
      return;
    }
    setVisible(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= ordered.length) {
        clearInterval(timer);
        setPlaying(false);
      }
    }, 450);
    return () => clearInterval(timer);
  }, [playing, ordered.length]);

  const missionName = (id: string) => missions.find((m) => m.id === id)?.name ?? id;
  const taskPlugin = (id: string) => tasks.find((t) => t.id === id)?.plugin;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Timeline replay</h3>
        <button
          className="btn-ghost py-1 text-xs"
          onClick={() => setPlaying(true)}
          disabled={playing || ordered.length === 0}
        >
          {playing ? "Replaying…" : "▶ Replay"}
        </button>
      </div>

      {ordered.length === 0 ? (
        <div className="py-8 text-center text-sm text-soc-muted">
          Events will appear here as the operation unfolds.
        </div>
      ) : (
        <ol className="relative border-l border-soc-border ml-2">
          {ordered.slice(0, visible).map((e) => {
            const meta = EVENT_META[e.event_type];
            const plugin = e.task_id ? taskPlugin(e.task_id) : null;
            return (
              <li key={e.id} className="mb-4 ml-4">
                <span
                  className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${meta.dot}`}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white">{meta.label}</span>
                  <span className="text-xs text-soc-muted shrink-0">
                    {formatTime(e.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-soc-muted font-mono mt-0.5">
                  {e.mission_id && (
                    <span className="text-white">{missionName(e.mission_id)} · </span>
                  )}
                  {plugin && <span className="text-soc-accent">{plugin} · </span>}
                  {e.node_id && <span>{e.node_id} · </span>}
                  {shortHash(e.payload_hash)}
                </div>
                <div className="mt-1 flex gap-2 items-center">
                  {isAnchored(e.onchain_status) ? (
                    <IntegrityBadge status="anchored" />
                  ) : e.onchain_status === "pending_chain" ? (
                    <IntegrityBadge status="pending_chain" />
                  ) : e.onchain_status === "disabled" ? (
                    <IntegrityBadge status="local_only" />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
