import { useState } from "react";
import { api } from "../api/client";
import type { EventType, LedgerEvent, OnChainStatus, VerifyResult } from "../types";
import { useI18n } from "../i18n";
import { shortHash } from "../utils";
import { CardTitle } from "./CardTitle";
import { IntegrityBadge } from "./HealthBadge";
import {
  BlockchainIcon,
  ClockIcon,
  CompletedTasksIcon,
  ConsoleIcon,
  DeviceIcon,
  FailedTasksIcon,
  LedgerIcon,
  MissionsIcon,
  PlayIcon,
  ShieldIcon,
  type NavIcon,
} from "./icons";

const ROW_ANIMATION_DELAY_MS = 30;
const TASK_EVENT_TOKEN = "TASK";
const LEDGER_BADGE_STATUS = {
  ANCHORED: "anchored",
  PENDING: "pending_chain",
  LOCAL: "local_only",
} as const;
const CHAIN_BADGE_STATUS: Record<OnChainStatus, string> = {
  confirmed: "anchored",
  anchored: "anchored",
  pending_chain: "pending_chain",
  disabled: "local_only",
};
const EVENT_ICON: Record<EventType, NavIcon> = {
  NODE_REGISTERED: DeviceIcon,
  NODE_RECONNECTED: DeviceIcon,
  NODE_DISCONNECTED: DeviceIcon,
  MISSION_CREATED: MissionsIcon,
  MISSION_STARTED: PlayIcon,
  TASK_SENT: ConsoleIcon,
  TASK_RESULT: CompletedTasksIcon,
  TASK_FAILED: FailedTasksIcon,
  MISSION_COMPLETED: CompletedTasksIcon,
  PLUGIN_BLOCKED: ShieldIcon,
  POLICY_BLOCKED: ShieldIcon,
  MISSION_MERKLE_ROOT: BlockchainIcon,
};

interface LedgerRowProps {
  event: LedgerEvent;
  highlighted: boolean;
  onAnchored?: () => void;
  animationDelayMs: number;
}

function LedgerRow({ event, highlighted, onAnchored, animationDelayMs }: LedgerRowProps) {
  const { t, formatTime, eventType, translateError } = useI18n();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const EventIcon = EVENT_ICON[event.event_type];
  const plugin =
    (event.payload?.data as Record<string, unknown> | undefined)?.plugin ??
    (event.event_type.includes(TASK_EVENT_TOKEN) ? t("common.task") : "");

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await api.verifyLedgerEvent(event.id));
    } catch (caughtError) {
      setError(translateError((caughtError as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const anchor = async () => {
    setBusy(true);
    setError("");
    try {
      await api.anchorLedgerEvent(event.id);
      onAnchored?.();
    } catch (caughtError) {
      setError(translateError((caughtError as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr
      className={`animate-fade-in border-b border-soc-borderSubtle/60 align-top last:border-0 row-hover ${
        highlighted ? "bg-soc-brand/10" : ""
      }`}
      style={{ animationDelay: `${animationDelayMs}ms`, animationFillMode: "both" }}
    >
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-soc-brand/25 bg-soc-brand/10 text-soc-brand">
            <EventIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white">{eventType(event.event_type)}</div>
            <div className="font-mono text-[11px] text-soc-muted">#{event.sequence}</div>
            {event.node_id ? <div className="text-[11px] text-soc-muted">{event.node_id}</div> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">
        <div className="text-soc-accent">{String(plugin)}</div>
        <div className="text-soc-muted">
          {t("ledger.localHash", { hash: shortHash(event.payload_hash) })}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">
        <IntegrityBadge status={CHAIN_BADGE_STATUS[event.onchain_status]} />
        {CHAIN_BADGE_STATUS[event.onchain_status] === LEDGER_BADGE_STATUS.ANCHORED ? (
          <div className="mt-1 text-soc-muted">
            {t("common.block", { num: event.block_number ?? 0 })}
          </div>
        ) : null}
        {event.tx_hash ? <div className="text-soc-muted">{shortHash(event.tx_hash, 6)}</div> : null}
      </td>
      <td className="px-4 py-3 text-xs text-soc-muted">
        <div className="flex items-center gap-1.5">
          <ClockIcon className="h-3.5 w-3.5" />
          {formatTime(event.timestamp)}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap items-center justify-end gap-1">
          {result ? <IntegrityBadge status={result.status} /> : null}
          {event.onchain_status === "pending_chain" ? (
            <button
              type="button"
              className="btn-ghost py-0.5 text-[10px]"
              onClick={() => void anchor()}
              disabled={busy}
            >
              <BlockchainIcon className="h-3.5 w-3.5" />
              {t("common.anchor")}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost py-0.5 text-[10px]"
            onClick={() => void verify()}
            disabled={busy}
          >
            <ShieldIcon className={`h-3.5 w-3.5 ${busy ? "animate-pulse-soft" : ""}`} />
            {t("common.verify")}
          </button>
        </div>
        {result ? (
          <div className="ml-auto mt-1 max-w-xs text-[10px] text-soc-muted">{result.detail}</div>
        ) : null}
        {error ? <div className="ml-auto mt-1 max-w-xs text-[10px] text-soc-err">{error}</div> : null}
      </td>
    </tr>
  );
}

interface LedgerPanelProps {
  events: LedgerEvent[];
  highlightId?: string;
  onAnchored?: () => void;
}

export function LedgerPanel({ events, highlightId, onAnchored }: LedgerPanelProps) {
  const { t } = useI18n();

  return (
    <section className="card-static animate-slide-up overflow-hidden">
      <div className="border-b border-soc-borderSubtle px-4 py-3">
        <CardTitle
          title={t("ledger.eventLog")}
          description={t("ledger.eventLogDescription")}
          Icon={LedgerIcon}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="border-b border-soc-border text-left text-xs uppercase tracking-wide text-soc-muted">
              <th className="px-4 py-3">{t("ledger.event")}</th>
              <th className="px-4 py-3">{t("ledger.pluginHash")}</th>
              <th className="px-4 py-3">{t("ledger.onChain")}</th>
              <th className="px-4 py-3">{t("console.time")}</th>
              <th className="px-4 py-3 text-right">{t("ledger.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-soc-muted">
                  {t("ledger.noEvents")}
                </td>
              </tr>
            ) : (
              events.map((event, index) => (
                <LedgerRow
                  key={event.id}
                  event={event}
                  highlighted={event.id === highlightId}
                  onAnchored={onAnchored}
                  animationDelayMs={index * ROW_ANIMATION_DELAY_MS}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
