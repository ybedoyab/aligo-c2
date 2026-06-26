import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { LedgerPanel } from "../components/LedgerPanel";
import { IntegrityBadge } from "../components/HealthBadge";
import { useC2 } from "../store";
import type { LedgerStats } from "../types";
import { shortHash } from "../utils";

export function Ledger() {
  const { ledger, refreshAll } = useC2();
  const location = useLocation();
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [anchorMsg, setAnchorMsg] = useState("");

  const loadStats = () => {
    api.ledgerStats().then(setStats).catch(() => setStats(null));
  };

  useEffect(() => {
    loadStats();
  }, [ledger.length]);

  const anchorPending = async () => {
    setAnchoring(true);
    setAnchorMsg("");
    try {
      const results = await api.anchorPendingLedger();
      const ok = results.filter((r) => r.success).length;
      setAnchorMsg(`Anchored ${ok}/${results.length} pending event(s).`);
      refreshAll();
      loadStats();
    } catch (e) {
      setAnchorMsg((e as Error).message);
    } finally {
      setAnchoring(false);
    }
  };

  const highlight =
    (location.state as { highlight?: string } | null)?.highlight ?? undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Proof-of-Execution Ledger</h1>
          <p className="text-sm text-soc-muted max-w-2xl">
            SHA-256 hashes over canonical JSON, chained and anchored on-chain. Verify
            compares local vs blockchain records.
          </p>
        </div>
        <button
          className="btn-primary text-sm"
          onClick={anchorPending}
          disabled={anchoring || (stats?.pending_chain ?? 0) === 0}
        >
          {anchoring ? "Anchoring…" : "Anchor pending events"}
        </button>
      </div>

      {anchorMsg && <div className="text-sm text-soc-muted">{anchorMsg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Total events" value={stats?.total_events ?? ledger.length} />
        <Stat label="Anchored" value={stats?.anchored_on_chain ?? 0} accent="text-soc-ok" />
        <Stat label="Pending" value={stats?.pending_chain ?? 0} accent="text-soc-warn" />
        <Stat label="Verified" value={stats?.verified ?? 0} accent="text-soc-ok" />
        <Stat label="Tampered" value={stats?.tampered ?? 0} accent="text-soc-err" />
        <div className="card p-3">
          <div className="text-[10px] uppercase text-soc-muted">Chain</div>
          {stats?.chain ? (
            <>
              <IntegrityBadge status={stats.chain.status} />
              <div className="text-[10px] text-soc-muted mt-1 font-mono truncate">
                {stats.chain.contract_address
                  ? shortHash(stats.chain.contract_address, 6)
                  : "no contract"}
              </div>
            </>
          ) : (
            <span className="text-white text-lg">—</span>
          )}
        </div>
      </div>

      {stats?.chain && (
        <div className="card p-4 text-xs text-soc-muted">
          <span className="text-white font-medium">RPC:</span> {stats.chain.rpc_url} ·{" "}
          <span className="text-white font-medium">Detail:</span> {stats.chain.detail}
        </div>
      )}

      <LedgerPanel events={ledger} highlightId={highlight} onAnchored={loadStats} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase text-soc-muted">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${accent ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
