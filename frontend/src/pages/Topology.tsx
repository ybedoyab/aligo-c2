import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HealthBadge, StatusBadge } from "../components/HealthBadge";
import { useC2 } from "../store";

export function Topology() {
  const { nodes, health } = useC2();
  const online = nodes.filter((n) => n.status === "online" && n.enabled);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Topology</h1>
        <p className="text-sm text-soc-muted">
          Lab view of operator UI, C2 server, connected nodes, and blockchain ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        <TopoBox title="Operator UI" subtitle="React dashboard">
          <p className="text-xs text-soc-muted">You are here — REST + WebSocket operator channel.</p>
          <Link to="/" className="text-xs text-soc-accent mt-2 inline-block">
            Open dashboard →
          </Link>
        </TopoBox>

        <div className="hidden lg:flex items-center justify-center text-soc-muted text-2xl">→</div>

        <TopoBox title="C2 Server" subtitle="FastAPI + ledger">
          <p className="text-xs text-soc-muted">v{health?.version ?? "—"}</p>
          <StatusBadge status={health?.chain_status ?? "local_only"} />
          <p className="text-xs text-soc-muted mt-2">{online.length} nodes connected via WS</p>
        </TopoBox>

        <div className="hidden lg:flex items-center justify-center text-soc-muted text-2xl">→</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Online nodes ({online.length})</h3>
          {online.length === 0 ? (
            <p className="text-sm text-soc-muted">No nodes connected. Run `python dev.py` or start nodes manually.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {online.map((n) => (
                <Link
                  key={n.id}
                  to={`/nodes/${n.id}`}
                  className="border border-soc-border rounded-lg p-3 hover:border-soc-accent transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-sm text-white">{n.alias || n.id}</span>
                    <StatusBadge status={n.status} />
                  </div>
                  <p className="text-xs text-soc-muted mt-1">{n.os} · {n.policy_id}</p>
                  <div className="mt-2">
                    <HealthBadge score={n.health_score} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <TopoBox title="Blockchain ledger" subtitle="ExecutionLedger.sol">
          <p className="text-xs text-soc-muted break-all">
            {health?.contract_address ?? "Contract not configured"}
          </p>
          <Link to="/ledger" className="text-xs text-soc-accent mt-2 inline-block">
            Open ledger →
          </Link>
        </TopoBox>
      </div>
    </div>
  );
}

function TopoBox({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-soc-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
