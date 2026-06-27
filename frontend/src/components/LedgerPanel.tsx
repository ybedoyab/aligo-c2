import { useState } from "react";
import { api } from "../api/client";
import type { LedgerEvent, VerifyResult } from "../types";
import { useI18n } from "../i18n";
import { shortHash } from "../utils";
import { IntegrityBadge } from "./HealthBadge";

function isAnchored(status: string) {
  return status === "confirmed" || status === "anchored";
}

function LedgerRow({
  event,
  highlighted,
  onAnchored,
}: {
  event: LedgerEvent;
  highlighted?: boolean;
  onAnchored?: () => void;
}) {
  const { t, formatTime } = useI18n();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const plugin =
    (event.payload?.data as Record<string, unknown> | undefined)?.plugin ??
    (event.event_type.includes("TASK") ? t("common.task") : "");

  const verify = async () => {
    setBusy(true);
    try {
      setResult(await api.verifyLedgerEvent(event.id));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const anchor = async () => {
    setBusy(true);
    try {
      await api.anchorLedgerEvent(event.id);
      onAnchored?.();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr
      className={`border-b border-soc-borderSubtle/60 last:border-0 row-hover align-top ${
        highlighted ? "bg-soc-brand/10" : ""
      }`}
    >
      <td className="px-4 py-3">
        <div className="text-xs font-semibold text-white">{event.event_type}</div>
        <div className="text-[11px] text-soc-muted font-mono">#{event.sequence}</div>
        {event.node_id && (
          <div className="text-[11px] text-soc-muted">{event.node_id}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono">
        <div className="text-soc-accent">{String(plugin)}</div>
        <div className="text-soc-muted">
          {t("ledger.localHash", { hash: shortHash(event.payload_hash) })}
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono">
        {isAnchored(event.onchain_status) ? (
          <>
            <IntegrityBadge status="anchored" />
            <div className="text-soc-muted mt-1">
              {t("common.block", { num: event.block_number ?? 0 })}
            </div>
          </>
        ) : event.onchain_status === "pending_chain" ? (
          <IntegrityBadge status="pending_chain" />
        ) : (
          <IntegrityBadge status="local_only" />
        )}
        {event.tx_hash && (
          <div className="text-soc-muted">{shortHash(event.tx_hash, 6)}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-soc-muted">{formatTime(event.timestamp)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 flex-wrap">
          {result && <IntegrityBadge status={result.status} />}
          {event.onchain_status === "pending_chain" && (
            <button className="btn-ghost py-0.5 text-[10px]" onClick={anchor} disabled={busy}>
              {t("common.anchor")}
            </button>
          )}
          <button className="btn-ghost py-0.5 text-[10px]" onClick={verify} disabled={busy}>
            {t("common.verify")}
          </button>
        </div>
        {result && (
          <div className="mt-1 text-[10px] text-soc-muted max-w-xs ml-auto">{result.detail}</div>
        )}
      </td>
    </tr>
  );
}

export function LedgerPanel({
  events,
  highlightId,
  onAnchored,
}: {
  events: LedgerEvent[];
  highlightId?: string;
  onAnchored?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="card-static overflow-hidden">
      <div className="panel-header">
        {t("ledger.eventLog")}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-soc-muted border-b border-soc-border">
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
              events.map((e) => (
                <LedgerRow
                  key={e.id}
                  event={e}
                  highlighted={e.id === highlightId}
                  onAnchored={onAnchored}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
