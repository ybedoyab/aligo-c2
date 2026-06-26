import { useState } from "react";
import { api } from "../api/client";
import type { LedgerEvent, VerifyResult } from "../types";
import { formatTime, shortHash } from "../utils";

function VerifyPill({ result }: { result: VerifyResult }) {
  const style =
    result.status === "verified"
      ? "text-soc-ok border-soc-ok/40 bg-soc-ok/10"
      : result.status === "tampered"
      ? "text-soc-err border-soc-err/40 bg-soc-err/10"
      : "text-soc-warn border-soc-warn/40 bg-soc-warn/10";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {result.status}
    </span>
  );
}

function LedgerRow({ event }: { event: LedgerEvent }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <tr className="border-b border-soc-border/40 last:border-0 hover:bg-soc-panel2/50 align-top">
      <td className="px-4 py-3">
        <div className="text-xs font-semibold text-white">{event.event_type}</div>
        <div className="text-[11px] text-soc-muted font-mono">#{event.sequence}</div>
      </td>
      <td className="px-4 py-3 text-xs text-soc-muted font-mono">
        <div>local: <span className="text-soc-accent">{shortHash(event.payload_hash)}</span></div>
        <div>prev: {shortHash(event.previous_hash)}</div>
      </td>
      <td className="px-4 py-3 text-xs font-mono">
        {event.onchain_status === "confirmed" ? (
          <span className="text-soc-ok">block #{event.block_number}</span>
        ) : (
          <span className="text-soc-warn">{event.onchain_status}</span>
        )}
        {event.tx_hash && (
          <div className="text-soc-muted">{shortHash(event.tx_hash, 6)}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-soc-muted">{formatTime(event.timestamp)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {result && <VerifyPill result={result} />}
          <button className="btn-ghost py-1 text-xs" onClick={verify} disabled={busy}>
            {busy ? "…" : "Verify"}
          </button>
        </div>
        {result && (
          <div className="mt-1 text-[11px] text-soc-muted max-w-xs ml-auto">
            {result.detail}
          </div>
        )}
      </td>
    </tr>
  );
}

export function LedgerPanel({ events }: { events: LedgerEvent[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-soc-border text-sm font-semibold text-white">
        Proof-of-Execution Ledger
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-soc-muted border-b border-soc-border">
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Hashes</th>
              <th className="px-4 py-3">On-chain</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3 text-right">Integrity</th>
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
              events.map((e) => <LedgerRow key={e.id} event={e} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
