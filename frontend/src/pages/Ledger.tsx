import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { CardTitle } from "../components/CardTitle";
import { IntegrityBadge } from "../components/HealthBadge";
import {
  BlockchainIcon,
  ClockIcon,
  CompletedTasksIcon,
  FailedTasksIcon,
  LedgerIcon,
  ServerIcon,
  type NavIcon,
} from "../components/icons";
import { LedgerPanel } from "../components/LedgerPanel";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { LedgerStats } from "../types";
import { shortHash } from "../utils";

const STAT_ANIMATION_DELAY_MS = 55;

interface LedgerStatCardProps {
  label: string;
  value: number;
  Icon: NavIcon;
  accentClass: string;
  animationDelayMs: number;
}

export function Ledger() {
  const { t, translateError } = useI18n();
  const { ledger, refreshAll } = useC2();
  const location = useLocation();
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [anchorMsg, setAnchorMsg] = useState("");

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.ledgerStats());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [ledger.length, loadStats]);

  const anchorPending = async () => {
    setAnchoring(true);
    setAnchorMsg("");
    try {
      const results = await api.anchorPendingLedger();
      const anchoredCount = results.filter((result) => result.success).length;
      setAnchorMsg(t("ledger.anchoredCount", { ok: anchoredCount, total: results.length }));
      refreshAll();
      await loadStats();
    } catch (error) {
      setAnchorMsg(translateError((error as Error).message));
    } finally {
      setAnchoring(false);
    }
  };

  const highlight =
    (location.state as { highlight?: string } | null)?.highlight ?? undefined;
  const statCards: Omit<LedgerStatCardProps, "animationDelayMs">[] = [
    {
      label: t("ledger.totalEvents"),
      value: stats?.total_events ?? ledger.length,
      Icon: LedgerIcon,
      accentClass: "border-soc-accent/30 text-soc-accent",
    },
    {
      label: t("ledger.anchored"),
      value: stats?.anchored_on_chain ?? 0,
      Icon: BlockchainIcon,
      accentClass: "border-soc-ok/30 text-soc-ok",
    },
    {
      label: t("ledger.pending"),
      value: stats?.pending_chain ?? 0,
      Icon: ClockIcon,
      accentClass: "border-soc-warn/30 text-soc-warn",
    },
    {
      label: t("ledger.verified"),
      value: stats?.verified ?? 0,
      Icon: CompletedTasksIcon,
      accentClass: "border-soc-ok/30 text-soc-ok",
    },
    {
      label: t("ledger.tampered"),
      value: stats?.tampered ?? 0,
      Icon: FailedTasksIcon,
      accentClass: "border-soc-err/30 text-soc-err",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">{t("ledger.title")}</h1>
          <p className="max-w-2xl text-sm text-soc-muted">{t("ledger.description")}</p>
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => void anchorPending()}
          disabled={anchoring || (stats?.pending_chain ?? 0) === 0}
        >
          <BlockchainIcon className={`h-4 w-4 ${anchoring ? "animate-pulse-soft" : ""}`} />
          {anchoring ? t("common.anchoring") : t("ledger.anchorPending")}
        </button>
      </header>

      {anchorMsg ? (
        <div className="flex animate-fade-in items-center gap-2 rounded-lg border border-soc-borderSubtle bg-soc-bg/40 px-3 py-2 text-sm text-soc-muted">
          <BlockchainIcon className="h-4 w-4 shrink-0 text-soc-accent2" />
          {anchorMsg}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat, index) => (
          <LedgerStatCard
            key={stat.label}
            {...stat}
            animationDelayMs={index * STAT_ANIMATION_DELAY_MS}
          />
        ))}
        <div
          className="card animate-slide-up p-3"
          style={{
            animationDelay: `${statCards.length * STAT_ANIMATION_DELAY_MS}ms`,
            animationFillMode: "both",
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase text-soc-muted">{t("ledger.chain")}</div>
            <ServerIcon className="h-4 w-4 text-soc-accent2" />
          </div>
          {stats?.chain ? (
            <>
              <IntegrityBadge status={stats.chain.status} />
              <div className="mt-1 truncate font-mono text-[10px] text-soc-muted">
                {stats.chain.contract_address
                  ? shortHash(stats.chain.contract_address, 6)
                  : t("common.noContract")}
              </div>
            </>
          ) : (
            <span className="text-lg text-white">{t("common.dash")}</span>
          )}
        </div>
      </section>

      {stats?.chain ? (
        <section className="card animate-fade-in p-4">
          <CardTitle
            title={t("ledger.chainConnection")}
            description={stats.chain.detail}
            Icon={ServerIcon}
            className="mb-3"
          />
          <div className="break-all font-mono text-xs text-soc-muted">
            <span className="font-sans font-medium text-white">{t("common.rpc")}:</span>{" "}
            {stats.chain.rpc_url}
          </div>
        </section>
      ) : null}

      <LedgerPanel events={ledger} highlightId={highlight} onAnchored={loadStats} />
    </div>
  );
}

function LedgerStatCard({
  label,
  value,
  Icon,
  accentClass,
  animationDelayMs,
}: LedgerStatCardProps) {
  return (
    <article
      className="card flex animate-slide-up items-center gap-3 p-3 transition-transform hover:-translate-y-0.5"
      style={{ animationDelay: `${animationDelayMs}ms`, animationFillMode: "both" }}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-soc-bg/60 ${accentClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-semibold text-white tabular-nums">{value}</div>
        <div className="truncate text-[10px] uppercase text-soc-muted">{label}</div>
      </div>
    </article>
  );
}
