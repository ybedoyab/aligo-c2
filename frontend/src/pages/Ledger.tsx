import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { LedgerPanel } from "../components/LedgerPanel";
import { IntegrityBadge } from "../components/HealthBadge";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { LedgerStats } from "../types";
import { shortHash } from "../utils";

export function Ledger() {
  const { t, translateError } = useI18n();
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
      setAnchorMsg(t("ledger.anchoredCount", { ok, total: results.length }));
      refreshAll();
      loadStats();
    } catch (e) {
      setAnchorMsg(translateError((e as Error).message));
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
          <h1 className="text-xl font-semibold text-white">{t("ledger.title")}</h1>
          <p className="text-sm text-soc-muted max-w-2xl">{t("ledger.description")}</p>
        </div>
        <button
          className="btn-primary text-sm"
          onClick={anchorPending}
          disabled={anchoring || (stats?.pending_chain ?? 0) === 0}
        >
          {anchoring ? t("common.anchoring") : t("ledger.anchorPending")}
        </button>
      </div>

      {anchorMsg && <div className="text-sm text-soc-muted">{anchorMsg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label={t("ledger.totalEvents")} value={stats?.total_events ?? ledger.length} />
        <Stat
          label={t("ledger.anchored")}
          value={stats?.anchored_on_chain ?? 0}
          accent="text-soc-ok"
        />
        <Stat
          label={t("ledger.pending")}
          value={stats?.pending_chain ?? 0}
          accent="text-soc-warn"
        />
        <Stat
          label={t("ledger.verified")}
          value={stats?.verified ?? 0}
          accent="text-soc-ok"
        />
        <Stat
          label={t("ledger.tampered")}
          value={stats?.tampered ?? 0}
          accent="text-soc-err"
        />
        <div className="card p-3">
          <div className="text-[10px] uppercase text-soc-muted">{t("ledger.chain")}</div>
          {stats?.chain ? (
            <>
              <IntegrityBadge status={stats.chain.status} />
              <div className="text-[10px] text-soc-muted mt-1 font-mono truncate">
                {stats.chain.contract_address
                  ? shortHash(stats.chain.contract_address, 6)
                  : t("common.noContract")}
              </div>
            </>
          ) : (
            <span className="text-white text-lg">{t("common.dash")}</span>
          )}
        </div>
      </div>

      {stats?.chain && (
        <div className="card p-4 text-xs text-soc-muted">
          <span className="text-white font-medium">{t("common.rpc")}:</span> {stats.chain.rpc_url}{" "}
          · <span className="text-white font-medium">{t("common.detail")}:</span>{" "}
          {stats.chain.detail}
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
      <div className={`text-xl font-semibold mt-0.5 ${accent ?? "text-white"}`}>{value}</div>
    </div>
  );
}
