import { useState } from "react";
import { api } from "../api/client";
import type { LedgerEvent, VerifyResult } from "../types";
import { formatTime, shortHash } from "../utils";
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
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const plugin =
    (event.payload?.data as Record<string, unknown> | undefined)?.plugin ??
    (event.event_type.includes("TASK") ? "task" : "");

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
      className={`border-b border-soc-border/40 last:border-0 hover:bg-soc-panel2/50 align-top ${
        highlighted ? "bg-soc-accent/10" : ""
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
          local: {shortHash(event.payload_hash)}
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono">
        {isAnchored(event.onchain_status) ? (
          <>
            <IntegrityBadge status="anchored" />
            <div className="text-soc-muted mt-1">block #{event.block_number}</div>
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
              Anchor
            </button>
          )}
          <button className="btn-ghost py-0.5 text-[10px]" onClick={verify} disabled={busy}>
            Verify
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
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-soc-border text-sm font-semibold text-white">
        Event log
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-soc-muted border-b border-soc-border">
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Plugin / hash</th>
              <th className="px-4 py-3">On-chain</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-soc-muted">
                  No ledger events yet.
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
