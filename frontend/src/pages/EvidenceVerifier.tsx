import { useState } from "react";
import { api } from "../api/client";
import type { EvidenceVerifyResult } from "../types";
import { IntegrityBadge } from "../components/HealthBadge";

export function EvidenceVerifier() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<EvidenceVerifyResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const runVerify = async (bundle: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      setResult(await api.verifyEvidenceBundle(bundle));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPasteVerify = () => {
    try {
      const bundle = JSON.parse(text) as Record<string, unknown>;
      void runVerify(bundle);
    } catch {
      setError("Invalid JSON — paste a full evidence bundle");
    }
  };

  const onFile = async (file: File) => {
    const raw = await file.text();
    setText(raw);
    try {
      await runVerify(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      setError("Invalid JSON file");
    }
  };

  const loadFromTask = async () => {
    const taskId = prompt("Task ID to export and verify:");
    if (!taskId) return;
    setBusy(true);
    try {
      const bundle = await api.getEvidenceBundle(taskId);
      const json = JSON.stringify(bundle, null, 2);
      setText(json);
      setResult(await api.verifyEvidenceBundle(bundle as unknown as Record<string, unknown>));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Independent Evidence Verifier</h1>
        <p className="text-sm text-soc-muted mt-1">
          Upload or paste an evidence JSON bundle. Recalculates hashes, verifies node
          signatures, Merkle proofs, and on-chain anchors — without trusting the dashboard.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <textarea
          className="input font-mono text-xs min-h-[200px]"
          placeholder='Paste evidence bundle JSON…'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary text-xs" disabled={busy} onClick={onPasteVerify}>
            Verify bundle
          </button>
          <label className="btn-ghost text-xs cursor-pointer">
            Upload JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          <button className="btn-ghost text-xs" disabled={busy} onClick={loadFromTask}>
            Load task bundle
          </button>
        </div>
        {error && <div className="text-xs text-soc-err">{error}</div>}
      </div>

      {result && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-white">{result.status}</span>
            <IntegrityBadge
              status={
                result.status === "VERIFIED"
                  ? "verified"
                  : result.status === "TAMPERED"
                    ? "tampered"
                    : "unknown"
              }
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white mb-2">Checks</h3>
            <ul className="space-y-1 text-xs">
              {result.checks.map((c) => (
                <li key={c.check} className="font-mono text-soc-muted">
                  {c.pass === true ? "✓" : c.pass === false ? "✗" : "○"} {c.check}:{" "}
                  {String(c.detail).slice(0, 80)}
                </li>
              ))}
            </ul>
          </div>
          {result.diff.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-soc-err mb-2">Evidence diff</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-soc-muted text-left">
                    <th className="py-1">Field</th>
                    <th className="py-1">Anchored</th>
                    <th className="py-1">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {result.diff.map((d) => (
                    <tr key={d.field} className="border-t border-soc-border/40">
                      <td className="py-2 font-mono text-soc-accent">{d.field}</td>
                      <td className="py-2 text-soc-ok break-all">{d.original}</td>
                      <td className="py-2 text-soc-err break-all">{d.current}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
