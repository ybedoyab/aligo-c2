import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { EvidenceBundle, TaskEvidence, VerifyResult } from "../types";
import { formatTime, shortHash } from "../utils";
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
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!taskId) {
      setEvidence(null);
      setBundle(null);
      return;
    }
    setError("");
    setVerify(null);
    api
      .getTaskEvidence(taskId)
      .then(setEvidence)
      .catch((e) => setError((e as Error).message));
    api
      .getEvidenceBundle(taskId)
      .then(setBundle)
      .catch(() => setBundle(null));
  }, [taskId]);

  if (!taskId) return null;

  const fullJson = () => JSON.stringify(bundle ?? evidence, null, 2);

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
    void navigator.clipboard.writeText(fullJson());
  };

  const exportJson = () => {
    const blob = new Blob([fullJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidence-${taskId}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
              {evidence.signature_status && (
                <StatusBadge status={evidence.signature_status} />
              )}
              {evidence.merkle_proof_status && (
                <span className="text-xs text-soc-muted">
                  merkle: {evidence.merkle_proof_status}
                </span>
              )}
              <span className="font-mono text-soc-accent">{evidence.plugin}</span>
              <span className="text-soc-muted">on {evidence.node_id}</span>
            </div>

            {evidence.iot_summary && (
              <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5 space-y-2">
                <div className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
                  IoT evidence summary
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Gateway" value={evidence.iot_summary.gateway} mono />
                  <Field label="Subdevice" value={evidence.iot_summary.subdevice ?? "—"} mono />
                  <Field label="Action" value={evidence.iot_summary.physical_style_action} />
                  <Field
                    label="Simulated"
                    value={evidence.iot_summary.simulated_execution ? "yes" : "no"}
                  />
                  <Field label="Evidence class" value={evidence.evidence_class ?? "iot_action"} />
                  <Field label="Node type" value={evidence.node_type ?? "iot_gateway"} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Mission" value={evidence.mission_name ?? evidence.mission_id} />
              <Field label="Node fingerprint" value={evidence.node_fingerprint ?? "—"} mono />
              <Field label="Signature" value={shortHash(evidence.node_signature, 16)} mono />
              <Field label="Signature status" value={evidence.signature_status ?? "—"} />
              <Field label="Mission Merkle root" value={shortHash(evidence.mission_merkle_root, 16)} mono />
              <Field label="Evidence hash" value={shortHash(evidence.evidence_hash, 16)} mono />
              <Field label="Local hash" value={shortHash(evidence.local_hash, 16)} mono />
              <Field label="On-chain status" value={evidence.on_chain_status ?? "—"} />
              <Field label="Block" value={String(evidence.block_number ?? "—")} />
              <Field
                label="TX hash"
                value={evidence.blockchain_tx_hash ? shortHash(evidence.blockchain_tx_hash, 12) : "—"}
                mono
              />
            </div>

            {evidence.policy_decision && (
              <div>
                <div className="text-xs text-soc-muted mb-1">Policy decision</div>
                <pre className="bg-soc-bg border border-soc-border rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  {JSON.stringify(evidence.policy_decision, null, 2)}
                </pre>
              </div>
            )}

            {evidence.chain_of_custody && evidence.chain_of_custody.length > 0 && (
              <div>
                <div className="text-xs text-soc-muted mb-2">Chain of custody</div>
                <ol className="space-y-2 border-l border-soc-border ml-2 pl-4">
                  {evidence.chain_of_custody.map((s) => (
                    <li key={s.step} className="text-xs">
                      <span className="text-white">{s.step}. {s.label}</span>
                      <span className="text-soc-muted ml-2">{s.status}</span>
                      {s.timestamp && (
                        <span className="text-soc-muted ml-2">{formatTime(s.timestamp)}</span>
                      )}
                      {s.detail && <div className="text-soc-muted font-mono">{s.detail}</div>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

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

            {verify && (
              <div className="text-xs text-soc-muted border border-soc-border rounded-lg p-3 space-y-2">
                <div>
                  Verify: <IntegrityBadge status={verify.status} /> — {verify.detail}
                </div>
                {verify.diff && verify.diff.length > 0 && (
                  <div>
                    <div className="text-soc-err font-medium mb-1">Tamper diff</div>
                    {verify.diff.map((d) => (
                      <div key={d.field} className="font-mono text-[11px] mb-1">
                        <span className="text-soc-accent">{d.field}</span>: anchored vs current
                      </div>
                    ))}
                  </div>
                )}
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
                Copy evidence JSON
              </button>
              <button className="btn-ghost text-xs" onClick={exportJson}>
                Export evidence JSON
              </button>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  onClose();
                  navigate("/evidence-verifier");
                }}
              >
                Open verifier
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
      <div className={`text-white break-all ${mono ? "font-mono text-[11px]" : ""}`}>{value}</div>
    </div>
  );
}
