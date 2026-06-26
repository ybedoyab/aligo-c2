import type { Task } from "../types";
import { formatTime } from "../utils";
import { StatusBadge } from "./HealthBadge";

export function TaskConsole({
  tasks,
  onOpenEvidence,
}: {
  tasks: Task[];
  onOpenEvidence?: (taskId: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-soc-border text-sm font-semibold text-white">
        Task activity
      </div>
      <div className="max-h-80 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-soc-muted">
            No tasks dispatched yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  className={`border-b border-soc-border/40 last:border-0 hover:bg-soc-panel2/50 ${
                    onOpenEvidence ? "cursor-pointer" : ""
                  }`}
                  onClick={() => onOpenEvidence?.(t.id)}
                >
                  <td className="px-4 py-2 font-mono text-xs text-soc-accent">{t.plugin}</td>
                  <td className="px-4 py-2 font-mono text-xs text-white">{t.node_id}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-soc-muted">
                    {formatTime(t.sent_at ?? t.created_at)}
                    {onOpenEvidence && (
                      <span className="ml-2 text-soc-accent">evidence</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
