import { useState } from "react";
import type { Result } from "../types";
import { formatTime } from "../utils";
import { StatusBadge } from "./HealthBadge";

function prettyStdout(stdout: string): string {
  if (!stdout) return "";
  try {
    return JSON.stringify(JSON.parse(stdout), null, 2);
  } catch {
    return stdout;
  }
}

function ResultRow({ result }: { result: Result }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-soc-border/50 last:border-0">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-soc-panel2/50"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={result.status} />
          <span className="font-mono text-xs text-white">{result.agent_id}</span>
          <span className="text-xs text-soc-muted">{result.task_id}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-soc-muted">
          <span>{result.duration_ms} ms</span>
          <span>exit {result.exit_code}</span>
          <span>{formatTime(result.created_at)}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {result.stdout && (
            <pre className="bg-soc-bg border border-soc-border rounded-lg p-3 text-xs font-mono text-soc-ok overflow-x-auto">
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

export function ResultViewer({ results }: { results: Result[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-soc-border text-sm font-semibold text-white">
        Results console
      </div>
      {results.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-soc-muted">
          No results yet.
        </div>
      ) : (
        results.map((r) => <ResultRow key={r.id} result={r} />)
      )}
    </div>
  );
}
