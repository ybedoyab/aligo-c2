import { useState } from "react";
import type { Result, Task } from "../types";
import { useI18n } from "../i18n";
import { StatusBadge } from "./HealthBadge";

function prettyStdout(stdout: string): string {
  if (!stdout) return "";
  try {
    return JSON.stringify(JSON.parse(stdout), null, 2);
  } catch {
    return stdout;
  }
}

function ResultRow({
  result,
  plugin,
  onOpenEvidence,
}: {
  result: Result;
  plugin: string;
  onOpenEvidence?: (taskId: string) => void;
}) {
  const { t, formatTime } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-soc-border/50 last:border-0">
      <button
        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 text-left row-hover"
        type="button"
        onClick={() => {
          if (onOpenEvidence) onOpenEvidence(result.task_id);
          else setOpen((o) => !o);
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={result.status} />
          <span className="font-mono text-xs text-soc-accent">{plugin}</span>
          <span className="font-mono text-xs text-white">{result.node_id}</span>
          <span className="text-xs text-soc-muted font-mono">{result.mission_id}</span>
          <span className="text-xs text-soc-muted">{result.task_id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-soc-muted sm:shrink-0">
          <span>
            {result.duration_ms} {t("common.ms")}
          </span>
          <span>
            {t("common.exit")} {result.exit_code}
          </span>
          <span>{formatTime(result.created_at)}</span>
          {onOpenEvidence && (
            <span className="text-soc-accent">{t("results.viewEvidence")}</span>
          )}
        </div>
      </button>
      {!onOpenEvidence && open && (
        <div className="px-4 pb-4">
          {result.stdout && (
            <pre className="surface-inset rounded-lg p-3 text-xs font-mono text-soc-ok overflow-x-auto">
              {prettyStdout(result.stdout)}
            </pre>
          )}
          {result.stderr && (
            <pre className="mt-2 bg-soc-bg border border-soc-err/40 rounded-lg p-3 text-xs font-mono text-soc-err overflow-x-auto">
              {result.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultViewer({
  results,
  tasks = [],
  onOpenEvidence,
}: {
  results: Result[];
  tasks?: Task[];
  onOpenEvidence?: (taskId: string) => void;
}) {
  const { t } = useI18n();
  const pluginFor = (taskId: string) =>
    tasks.find((task) => task.id === taskId)?.plugin ?? t("common.unknown");

  return (
    <div className="card-static overflow-hidden h-full flex flex-col">
      <div className="panel-header">
        {t("results.title")}
      </div>
      {results.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-soc-muted flex-1">
          {t("results.empty")}
        </div>
      ) : (
        <div className="flex-1">
          {results.map((r) => (
            <ResultRow
              key={r.id}
              result={r}
              plugin={pluginFor(r.task_id)}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
        </div>
      )}
    </div>
  );
}
