import { useEffect, useMemo } from "react";
import { StatusBadge } from "./HealthBadge";
import { CloseIcon, ConsoleIcon, PlayIcon } from "./icons";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { Mission, MissionStatus, Task } from "../types";
import { missionCatalogKey } from "../utils/missionLabels";

const TERMINAL_MISSION: MissionStatus[] = ["completed", "failed", "partially_failed"];
const TERMINAL_TASK = new Set(["success", "failed", "timeout", "blocked_by_policy"]);

interface Props {
  missionId: string | null;
  onClose: () => void;
  onOpenEvidence: (taskId: string) => void;
}

function missionLabel(
  t: (key: string) => string,
  mission: Mission | undefined,
  field: "name" | "description"
): string {
  if (!mission) return "";
  const key = `missions.catalog.${missionCatalogKey(mission.id)}.${field}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return field === "name" ? mission.name : mission.description;
}

export function MissionRunModal({ missionId, onClose, onOpenEvidence }: Props) {
  const { t, formatTime } = useI18n();
  const { missions, tasks, results } = useC2();

  const mission = useMemo(
    () => missions.find((m) => m.id === missionId) ?? null,
    [missions, missionId]
  );

  const missionTasks = useMemo(
    () =>
      missionId
        ? tasks
            .filter((t) => t.mission_id === missionId)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
        : [],
    [tasks, missionId]
  );

  const running = mission?.status === "running";
  const finished = mission ? TERMINAL_MISSION.includes(mission.status) : false;
  const allTasksDone =
    missionTasks.length > 0 && missionTasks.every((task) => TERMINAL_TASK.has(task.status));

  useEffect(() => {
    if (!missionId || !finished) return;
    const timer = window.setTimeout(() => {}, 0);
    return () => window.clearTimeout(timer);
  }, [missionId, finished]);

  if (!missionId || !mission) return null;

  const successCount = missionTasks.filter((task) => task.status === "success").length;
  const failedCount = missionTasks.filter(
    (task) => task.status === "failed" || task.status === "timeout"
  ).length;
  const blockedCount = missionTasks.filter((task) => task.status === "blocked_by_policy").length;

  const resultByTask = new Map(results.map((r) => [r.task_id, r]));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("common.close")}
      />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-soc-borderSubtle bg-soc-panel shadow-2xl animate-slide-up"
        role="dialog"
        aria-labelledby="mission-run-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-soc-borderSubtle px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PlayIcon className="h-4 w-4 shrink-0 text-soc-brand" />
              <h2 id="mission-run-title" className="truncate text-base font-semibold text-white">
                {missionLabel(t, mission, "name")}
              </h2>
              <StatusBadge status={mission.status} />
            </div>
            <p className="mt-1 text-xs text-soc-muted">{missionLabel(t, mission, "description")}</p>
          </div>
          <button type="button" className="icon-btn shrink-0" onClick={onClose}>
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Stat label={t("missions.runModal.started")} value={formatTime(mission.started_at)} />
            <Stat
              label={t("missions.runModal.finished")}
              value={mission.completed_at ? formatTime(mission.completed_at) : t("common.dash")}
            />
            <Stat label={t("missions.runModal.tasks")} value={String(missionTasks.length)} />
            <Stat
              label={t("missions.runModal.success")}
              value={`${successCount}/${missionTasks.length || "—"}`}
            />
          </div>

          {running && !allTasksDone ? (
            <div className="rounded-lg border border-soc-brand/30 bg-soc-brand/10 px-3 py-2 text-xs text-soc-brand">
              {t("missions.runModal.running")}
            </div>
          ) : null}

          {failedCount > 0 || blockedCount > 0 ? (
            <div className="rounded-lg border border-soc-warn/30 bg-soc-warn/10 px-3 py-2 text-xs text-soc-warn">
              {t("missions.runModal.summary", {
                success: successCount,
                failed: failedCount,
                blocked: blockedCount,
              })}
            </div>
          ) : null}

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white">
              <ConsoleIcon className="h-4 w-4 text-soc-muted" />
              {t("missions.runModal.taskActivity")}
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {missionTasks.length === 0 ? (
                <div className="text-xs text-soc-muted">{t("missions.runModal.waitingTasks")}</div>
              ) : (
                missionTasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    index={index + 1}
                    task={task}
                    hasResult={resultByTask.has(task.id)}
                    onOpenEvidence={() => onOpenEvidence(task.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-soc-borderSubtle px-5 py-3">
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>
            {t("common.close")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-soc-borderSubtle bg-soc-bg/40 p-2.5">
      <div className="text-[10px] uppercase text-soc-muted">{label}</div>
      <div className="mt-1 font-mono text-xs text-white">{value}</div>
    </div>
  );
}

function TaskRow({
  index,
  task,
  hasResult,
  onOpenEvidence,
}: {
  index: number;
  task: Task;
  hasResult: boolean;
  onOpenEvidence: () => void;
}) {
  const { t, formatTime } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-soc-borderSubtle bg-soc-bg/30 px-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-white">
          {index}. {task.plugin}{" "}
          <span className="font-normal text-soc-muted">· {task.node_id}</span>
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-soc-muted">
          {t("missions.runModal.sent")}: {formatTime(task.sent_at)} ·{" "}
          {t("missions.runModal.done")}: {formatTime(task.completed_at)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={task.status} />
        {hasResult ? (
          <button type="button" className="btn-ghost text-[10px] py-1 px-2" onClick={onOpenEvidence}>
            {t("nodeDetail.evidence")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
