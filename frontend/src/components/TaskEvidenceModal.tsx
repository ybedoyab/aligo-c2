import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { TaskEvidence, VerifyResult } from "../types";
import { shortHash } from "../utils";
import { IntegrityBadge, StatusBadge } from "./HealthBadge";

function prettyJson(raw: string): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

interface Props {
  taskId: string | null;
  onClose: () => void;
}

export function TaskEvidenceModal({ taskId, onClose }: Props) {
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<TaskEvidence | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!taskId) {
      setEvidence(null);
      return;
    }
    setError("");
    setVerify(null);
    api
      .getTaskEvidence(taskId)
      .then(setEvidence)
      .catch((e) => setError((e as Error).message));
  }, [taskId]);

  if (!taskId) return null;

  const runVerify = async () => {
    if (!evidence?.ledger_event_id) return;
    setBusy(true);
    try {
      setVerify(await api.verifyLedgerEvent(evidence.ledger_event_id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyJson = () => {
    if (!evidence) return;
    const payload = {
      task_id: evidence.task_id,
      plugin: evidence.plugin,
      args: evidence.args,
      status: evidence.status,
      stdout: evidence.stdout,
      stderr: evidence.stderr,
      exit_code: evidence.exit_code,
      duration_ms: evidence.duration_ms,
      local_hash: evidence.local_hash,
    };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-soc-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Task Execution Evidence</h2>
            <p className="text-xs text-soc-muted font-mono mt-0.5">{taskId}</p>
          </div>
          <button className="btn-ghost py-1 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="px-5 py-3 text-sm text-soc-err">{error}</div>}
        {!evidence && !error && (
          <div className="px-5 py-8 text-center text-soc-muted">Loading evidence…</div>
        )}

        {evidence && (
          <div className="p-5 space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 items-center">
              <StatusBadge status={evidence.status} />
              <IntegrityBadge status={evidence.integrity_status} />
              <span className="font-mono text-soc-accent">{evidence.plugin}</span>
              <span className="text-soc-muted">on {evidence.node_id}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Mission" value={evidence.mission_name ?? evidence.mission_id} />
              <Field label="Node" value={evidence.node_id} mono />
              <Field label="Exit code" value={String(evidence.exit_code ?? "—")} />
              <Field label="Duration" value={`${evidence.duration_ms ?? "—"} ms`} />
              <Field label="Local hash" value={shortHash(evidence.local_hash, 12)} mono />
              <Field label="Previous hash" value={shortHash(evidence.previous_hash, 12)} mono />
              <Field label="On-chain" value={evidence.on_chain_status ?? "—"} />
              <Field
                label="TX hash"
                value={evidence.blockchain_tx_hash ? shortHash(evidence.blockchain_tx_hash, 8) : "—"}
                mono
              />
            </div>

            <div>
              <div className="text-xs text-soc-muted mb-1">Arguments</div>
              <pre className="bg-soc-bg border border-soc-border rounded-lg p-3 text-xs font-mono overflow-x-auto">
                {JSON.stringify(evidence.args, null, 2)}
              </pre>
            </div>

            {evidence.stdout && (
              <div>
                <div className="text-xs text-soc-muted mb-1">stdout</div>
                <pre className="bg-soc-bg border border-soc-border rounded-lg p-3 text-xs font-mono text-soc-ok overflow-x-auto max-h-48">
                  {prettyJson(evidence.stdout)}
                </pre>
              </div>
            )}

            {evidence.stderr && (
              <div>
                <div className="text-xs text-soc-muted mb-1">stderr</div>
                <pre className="bg-soc-bg border border-soc-err/40 rounded-lg p-3 text-xs font-mono text-soc-err">
                  {evidence.stderr}
                </pre>
              </div>
            )}

            {verify && (
              <div className="text-xs text-soc-muted border border-soc-border rounded-lg p-3">
                Verify: <IntegrityBadge status={verify.status} /> — {verify.detail}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                className="btn-primary text-xs"
                onClick={runVerify}
                disabled={busy || !evidence.ledger_event_id}
              >
                {busy ? "Verifying…" : "Verify integrity"}
              </button>
              <button className="btn-ghost text-xs" onClick={copyJson}>
                Copy result JSON
              </button>
              {evidence.ledger_event_id && (
                <button
                  className="btn-ghost text-xs"
                  onClick={() => {
                    onClose();
                    navigate("/ledger", { state: { highlight: evidence.ledger_event_id } });
                  }}
                >
                  Open ledger event
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-soc-muted">{label}</div>
      <div className={`text-white ${mono ? "font-mono text-[11px]" : ""}`}>{value}</div>
    </div>
  );
}
