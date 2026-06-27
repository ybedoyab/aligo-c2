import { useMemo, useState } from "react";
import { api } from "../api/client";
import { CardTitle } from "../components/CardTitle";
import { StatusBadge } from "../components/HealthBadge";
import {
  BlockchainIcon,
  CompletedTasksIcon,
  ChevronDownIcon,
  ConsoleIcon,
  DownloadIcon,
  FailedTasksIcon,
  FilterIcon,
  GaugeIcon,
  HammerIcon,
  LedgerIcon,
  PlayIcon,
  SaveIcon,
  type NavIcon,
} from "../components/icons";
import { MissionBuilder } from "../components/MissionBuilder";
import { MissionRunModal } from "../components/MissionRunModal";
import { ResultViewer } from "../components/ResultViewer";
import { TaskConsole } from "../components/TaskConsole";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";
import { IOT_GATEWAY_ID } from "../constants/iot";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { Mission, MissionStatus } from "../types";
import { downloadMissionReport } from "../utils/missionReport";
import { missionCatalogKey } from "../utils/missionLabels";

const NODE_STATUS = {
  ONLINE: "online",
} as const;
const EXPORT_FORMAT = {
  JSON: "json",
  MARKDOWN: "markdown",
} as const;
const CARD_ANIMATION_DELAY_MS = 65;
const MISSION_STATUS_ICON: Record<MissionStatus, NavIcon> = {
  draft: SaveIcon,
  running: PlayIcon,
  completed: CompletedTasksIcon,
  failed: FailedTasksIcon,
  partially_failed: FailedTasksIcon,
};

const IOT_PLUGINS = new Set([
  "gateway_health",
  "list_devices",
  "get_device_info",
  "get_gateway_snapshot",
  "read_temperature",
  "read_humidity",
  "read_motion",
  "read_light",
  "led_on",
  "led_off",
  "led_blink",
  "led_set_brightness",
]);

type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

function missionLabel(
  t: (key: string) => string,
  mission: Mission,
  field: "name" | "description"
): string {
  const key = `missions.catalog.${missionCatalogKey(mission.id)}.${field}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return field === "name" ? mission.name : mission.description;
}

function resolveTargets(mission: Mission, onlineIds: string[]): string[] {
  if (mission.target_node_ids.length) return mission.target_node_ids;
  const stepNodes = [
    ...new Set(mission.steps.map((step) => step.node_id).filter(Boolean) as string[]),
  ];
  if (stepNodes.length) return stepNodes;
  const allIot = mission.steps.every((step) => IOT_PLUGINS.has(step.plugin));
  if (allIot && onlineIds.includes(IOT_GATEWAY_ID)) return [IOT_GATEWAY_ID];
  return onlineIds;
}

function ExportButtons({ missionId, disabled = false }: { missionId: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const run = async (format: ExportFormat) => {
    setBusy(true);
    try {
      await downloadMissionReport(missionId, format);
    } finally {
      setBusy(false);
    }
  };

  const isDisabled = disabled || busy;
  return (
    <>
      <button
        type="button"
        className="btn-ghost text-xs"
        disabled={isDisabled}
        onClick={() => void run(EXPORT_FORMAT.JSON)}
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        {t("common.exportJson")}
      </button>
      <button
        type="button"
        className="btn-ghost text-xs"
        disabled={isDisabled}
        onClick={() => void run(EXPORT_FORMAT.MARKDOWN)}
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        {t("common.exportMd")}
      </button>
    </>
  );
}

interface MissionCardProps {
  mission: Mission;
  onlineIds: string[];
  onChanged: () => void;
  onStarted: (missionId: string) => void;
  animationDelayMs: number;
}

function MissionCard({
  mission,
  onlineIds,
  onChanged,
  onStarted,
  animationDelayMs,
}: MissionCardProps) {
  const { t, status, translateError } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dryRun, setDryRun] = useState<string | null>(null);
  const targets = resolveTargets(mission, onlineIds);
  const MissionStatusIcon = MISSION_STATUS_ICON[mission.status];
  const displayName = missionLabel(t, mission, "name");
  const displayDescription = missionLabel(t, mission, "description");

  const dryRunMission = async () => {
    setBusy(true);
    setError("");
    setDryRun(null);
    try {
      const report = await api.dryRunMission(mission.id, targets);
      setDryRun(
        `${status(report.ready ? "READY" : "BLOCKED")} — ${report.summary} (${t("common.toDispatch", { count: report.tasks_to_dispatch })})`
      );
    } catch (caughtError) {
      setError(translateError((caughtError as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      if (targets.length === 0) throw new Error(t("errors.noNodesOnline"));
      await api.startMission(mission.id, targets);
      onStarted(mission.id);
      onChanged();
    } catch (caughtError) {
      setError(translateError((caughtError as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className="card group relative flex animate-slide-up flex-col gap-4 overflow-hidden p-4"
      style={{ animationDelay: `${animationDelayMs}ms`, animationFillMode: "both" }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-soc-brand/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-soc-brand/30 bg-soc-brand/10 text-soc-brand transition-transform group-hover:scale-105">
          <MissionStatusIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-white">{displayName}</h3>
            {mission.is_predefined ? (
              <span className="text-[10px] uppercase tracking-wide text-soc-accent2">
                {t("common.preset")}
              </span>
            ) : null}
            <StatusBadge status={mission.status} />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-soc-muted">{displayDescription}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-soc-muted">
          <ConsoleIcon className="h-3.5 w-3.5" />
          {t("common.steps")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {mission.steps.map((step, index) => (
            <span
              key={`${mission.id}-${index}-${step.plugin}`}
              className="rounded-md border border-soc-borderSubtle bg-soc-bg/50 px-2 py-1 font-mono text-[10px] text-soc-accent"
            >
              {index + 1}. {step.plugin}
            </span>
          ))}
        </div>
      </div>

      {mission.merkle_root ? (
        <div className="flex items-start gap-2 rounded-lg border border-soc-accent2/20 bg-soc-accent2/5 p-2.5 text-[11px] text-soc-accent2">
          <BlockchainIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-all font-mono">
            {t("common.merkleRoot")}: {mission.merkle_root.slice(0, 16)}… ·{" "}
            {status(mission.merkle_root_status ?? "unknown")}
          </span>
        </div>
      ) : null}
      {dryRun ? <div className="text-xs text-soc-warn">{dryRun}</div> : null}
      {error ? <div className="text-xs text-soc-err">{error}</div> : null}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-soc-border pt-3">
        <button type="button" className="btn-ghost text-xs" onClick={() => void dryRunMission()} disabled={busy}>
          <GaugeIcon className="h-3.5 w-3.5" />
          {t("missions.dryRun")}
        </button>
        <button type="button" className="btn-primary text-xs" onClick={() => void start()} disabled={busy}>
          <PlayIcon className={`h-3.5 w-3.5 ${busy ? "animate-pulse-soft" : ""}`} />
          {busy ? t("common.starting") : t("common.run")}
        </button>
        <ExportButtons missionId={mission.id} disabled={busy} />
      </div>
    </article>
  );
}

export function Missions() {
  const { t } = useI18n();
  const { missions, nodes, tasks, results, refreshAll } = useC2();
  const onlineIds = nodes
    .filter((node) => node.status === NODE_STATUS.ONLINE)
    .map((node) => node.id);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);
  const [runMissionId, setRunMissionId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredMissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return missions;
    return missions.filter((mission) => {
      const name = missionLabel(t, mission, "name").toLowerCase();
      const description = missionLabel(t, mission, "description").toLowerCase();
      const plugins = mission.steps.map((step) => step.plugin).join(" ").toLowerCase();
      return (
        name.includes(q) ||
        description.includes(q) ||
        mission.id.toLowerCase().includes(q) ||
        plugins.includes(q)
      );
    });
  }, [missions, search, t]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">{t("missions.title")}</h1>
        <p className="text-sm text-soc-muted">{t("missions.description")}</p>
      </header>

      <section className="card-static overflow-hidden">
        <button
          type="button"
          className="row-hover flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all duration-200"
          onClick={() => setBuilderOpen((open) => !open)}
          aria-expanded={builderOpen}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-soc-brand/30 bg-soc-brand/10 text-soc-brand">
              <HammerIcon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-white">{t("missions.buildMission")}</span>
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-soc-muted transition-transform ${builderOpen ? "rotate-180" : ""}`}
          />
        </button>
        {builderOpen ? (
          <div className="animate-slide-up border-t border-soc-border p-4 sm:p-5">
            <MissionBuilder nodes={nodes} onChanged={refreshAll} embedded />
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle title={t("missions.library")} Icon={LedgerIcon} />
          <label className="relative w-full sm:max-w-xs">
            <FilterIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soc-muted" />
            <input
              type="search"
              className="input pl-9 text-sm"
              placeholder={t("missions.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {filteredMissions.length === 0 ? (
          <div className="card p-6 text-center text-sm text-soc-muted">{t("missions.noMatches")}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredMissions.map((mission, index) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onlineIds={onlineIds}
                onChanged={refreshAll}
                onStarted={setRunMissionId}
                animationDelayMs={index * CARD_ANIMATION_DELAY_MS}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <TaskConsole tasks={tasks.slice(0, 30)} onOpenEvidence={setEvidenceTaskId} />
        <ResultViewer
          results={results.slice(0, 15)}
          tasks={tasks}
          onOpenEvidence={setEvidenceTaskId}
        />
      </div>

      <MissionRunModal
        missionId={runMissionId}
        onClose={() => setRunMissionId(null)}
        onOpenEvidence={(taskId) => {
          setRunMissionId(null);
          setEvidenceTaskId(taskId);
        }}
      />
      <TaskEvidenceModal taskId={evidenceTaskId} onClose={() => setEvidenceTaskId(null)} />
    </div>
  );
}
