import { useEffect, useMemo, useState } from "react";
import type { EventType, LedgerEvent, Mission, OnChainStatus, Task } from "../types";
import { useI18n } from "../i18n";
import { shortHash } from "../utils";
import { IntegrityBadge } from "./HealthBadge";
import { PlayIcon } from "./icons";

const EVENT_DOTS: Record<EventType, string> = {
  NODE_REGISTERED: "bg-soc-ok",
  NODE_RECONNECTED: "bg-soc-ok",
  NODE_DISCONNECTED: "bg-soc-err",
  MISSION_CREATED: "bg-soc-accent2",
  MISSION_STARTED: "bg-soc-accent",
  TASK_SENT: "bg-soc-accent",
  TASK_RESULT: "bg-soc-ok",
  TASK_FAILED: "bg-soc-err",
  MISSION_COMPLETED: "bg-soc-ok",
  PLUGIN_BLOCKED: "bg-soc-warn",
  POLICY_BLOCKED: "bg-soc-warn",
  MISSION_MERKLE_ROOT: "bg-soc-accent2",
};

const TIMELINE_INTEGRITY_STATUS = {
  ANCHORED: "anchored",
  PENDING: "pending_chain",
  LOCAL: "local_only",
} as const;

const INTEGRITY_BY_CHAIN_STATUS: Record<
  OnChainStatus,
  (typeof TIMELINE_INTEGRITY_STATUS)[keyof typeof TIMELINE_INTEGRITY_STATUS]
> = {
  confirmed: TIMELINE_INTEGRITY_STATUS.ANCHORED,
  anchored: TIMELINE_INTEGRITY_STATUS.ANCHORED,
  pending_chain: TIMELINE_INTEGRITY_STATUS.PENDING,
  disabled: TIMELINE_INTEGRITY_STATUS.LOCAL,
};

export function TimelineReplay({
  events,
  missions = [],
  tasks = [],
}: {
  events: LedgerEvent[];
  missions?: Mission[];
  tasks?: Task[];
}) {
  const { t, eventType, formatTime } = useI18n();
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
  const taskPlugin = (id: string) => tasks.find((task) => task.id === id)?.plugin;

  return (
    <section className="card h-full min-h-[32rem] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{t("timeline.title")}</h3>
        <button
          className="btn-ghost py-1 text-xs"
          onClick={() => setPlaying(true)}
          disabled={playing || ordered.length === 0}
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {playing ? t("common.replaying") : t("common.replay")}
        </button>
      </div>

      {ordered.length === 0 ? (
        <div className="py-8 text-center text-sm text-soc-muted">{t("timeline.empty")}</div>
      ) : (
        <ol className="relative ml-2 max-h-[27rem] overflow-y-auto border-l border-soc-borderSubtle pr-2">
          {ordered.slice(0, visible).map((e) => {
            const dot = EVENT_DOTS[e.event_type];
            const plugin = e.task_id ? taskPlugin(e.task_id) : null;
            return (
              <li key={e.id} className="mb-4 ml-4">
                <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${dot}`} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white">{eventType(e.event_type)}</span>
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
                <div className="mt-1 flex items-center gap-2">
                  <IntegrityBadge status={INTEGRITY_BY_CHAIN_STATUS[e.onchain_status]} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
