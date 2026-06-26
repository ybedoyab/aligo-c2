import type { AgentStatus, MissionStatus, TaskStatus } from "../types";

const STATUS_STYLES: Record<string, string> = {
  online: "bg-soc-ok/15 text-soc-ok border-soc-ok/40",
  offline: "bg-soc-err/10 text-soc-err border-soc-err/30",
  warning: "bg-soc-warn/15 text-soc-warn border-soc-warn/40",
  error: "bg-soc-err/15 text-soc-err border-soc-err/40",
  // mission / task
  draft: "bg-soc-muted/10 text-soc-muted border-soc-border",
  running: "bg-soc-accent/15 text-soc-accent border-soc-accent/40",
  completed: "bg-soc-ok/15 text-soc-ok border-soc-ok/40",
  success: "bg-soc-ok/15 text-soc-ok border-soc-ok/40",
  failed: "bg-soc-err/15 text-soc-err border-soc-err/40",
  partially_failed: "bg-soc-warn/15 text-soc-warn border-soc-warn/40",
  timeout: "bg-soc-warn/15 text-soc-warn border-soc-warn/40",
  pending: "bg-soc-muted/10 text-soc-muted border-soc-border",
  sent: "bg-soc-accent2/15 text-soc-accent2 border-soc-accent2/40",
};

export function StatusBadge({
  status,
}: {
  status: AgentStatus | MissionStatus | TaskStatus | string;
}) {
  const style = STATUS_STYLES[status] ?? "bg-soc-muted/10 text-soc-muted border-soc-border";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-soc-ok" : score >= 40 ? "text-soc-warn" : "text-soc-err";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-soc-border">
        <div
          className={`h-full rounded-full ${
            score >= 80 ? "bg-soc-ok" : score >= 40 ? "bg-soc-warn" : "bg-soc-err"
          }`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${color}`}>{score}</span>
    </div>
  );
}
