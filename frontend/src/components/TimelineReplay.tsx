import { useEffect, useMemo, useState } from "react";
import type { EventType, LedgerEvent } from "../types";
import { formatTime, shortHash } from "../utils";

const EVENT_META: Record<EventType, { label: string; dot: string }> = {
  AGENT_REGISTERED: { label: "Agent connected", dot: "bg-soc-ok" },
  AGENT_RECONNECTED: { label: "Agent reconnected", dot: "bg-soc-ok" },
  AGENT_DISCONNECTED: { label: "Agent disconnected", dot: "bg-soc-err" },
  MISSION_CREATED: { label: "Mission created", dot: "bg-soc-accent2" },
  MISSION_STARTED: { label: "Mission started", dot: "bg-soc-accent" },
  TASK_SENT: { label: "Task sent", dot: "bg-soc-accent" },
  TASK_RESULT: { label: "Result received", dot: "bg-soc-ok" },
  TASK_FAILED: { label: "Task failed", dot: "bg-soc-err" },
  MISSION_COMPLETED: { label: "Mission completed", dot: "bg-soc-ok" },
};

export function TimelineReplay({ events }: { events: LedgerEvent[] }) {
  // Show chronological order (oldest first).
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
            return (
              <li key={e.id} className="mb-4 ml-4">
                <span
                  className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${meta.dot}`}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{meta.label}</span>
                  <span className="text-xs text-soc-muted">
                    {formatTime(e.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-soc-muted font-mono">
                  {e.agent_id && <span>{e.agent_id} · </span>}
                  {shortHash(e.payload_hash)}
                  {e.onchain_status === "confirmed" && (
                    <span className="text-soc-ok"> · anchored</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
