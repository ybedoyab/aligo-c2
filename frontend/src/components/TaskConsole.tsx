import type { Task } from "../types";
import { useI18n } from "../i18n";
import { StatusBadge } from "./HealthBadge";

function TaskRow({
  task,
  onOpenEvidence,
}: {
  task: Task;
  onOpenEvidence?: (taskId: string) => void;
}) {
  const { t, formatTime } = useI18n();

  return (
    <div className="border-b border-soc-border/50 last:border-0">
      <button
        type="button"
        className={`w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 text-left row-hover ${
          onOpenEvidence ? "cursor-pointer" : ""
        }`}
        onClick={() => onOpenEvidence?.(task.id)}
      >
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <span className="font-mono text-xs text-soc-accent">{task.plugin}</span>
          <span className="font-mono text-xs text-white">{task.node_id}</span>
          <span className="text-xs text-soc-muted font-mono break-all">{task.mission_id}</span>
          <StatusBadge status={task.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-soc-muted sm:shrink-0">
          <span>{formatTime(task.sent_at ?? task.created_at)}</span>
          {onOpenEvidence && (
            <span className="text-soc-accent">{t("common.viewEvidence")}</span>
          )}
        </div>
      </button>
    </div>
  );
}

export function TaskConsole({
  tasks,
  onOpenEvidence,
}: {
  tasks: Task[];
  onOpenEvidence?: (taskId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="card-static overflow-hidden h-full flex flex-col">
      <div className="panel-header">
        {t("taskConsole.title")}
      </div>
      {tasks.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-soc-muted flex-1">
          {t("taskConsole.empty")}
        </div>
      ) : (
        <div className="flex-1">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpenEvidence={onOpenEvidence} />
          ))}
        </div>
      )}
    </div>
  );
}
