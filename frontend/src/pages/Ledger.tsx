import { LedgerPanel } from "../components/LedgerPanel";
import { useC2 } from "../store";

export function Ledger() {
  const { ledger, health } = useC2();
  const confirmed = ledger.filter((e) => e.onchain_status === "confirmed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Proof-of-Execution Ledger</h1>
        <p className="text-sm text-soc-muted">
          Every event is hashed (SHA-256 over canonical JSON), chained via previous_hash,
          and anchored on a private blockchain. Click Verify to compare the local hash with
          the on-chain record.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-soc-muted uppercase">Total events</div>
          <div className="text-2xl font-semibold text-white mt-1">{ledger.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-soc-muted uppercase">Anchored on-chain</div>
          <div className="text-2xl font-semibold text-soc-ok mt-1">{confirmed}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-soc-muted uppercase">Chain status</div>
          <div className="text-sm text-soc-muted mt-2">{health?.ledger_detail ?? "—"}</div>
        </div>
      </div>

      <LedgerPanel events={ledger} />
    </div>
  );
}
