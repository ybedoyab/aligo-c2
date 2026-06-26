import { NavLink, Outlet } from "react-router-dom";
import { useC2 } from "../store";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/nodes", label: "Nodes" },
  { to: "/missions", label: "Missions" },
  { to: "/console", label: "Console" },
  { to: "/ledger", label: "Ledger" },
  { to: "/demo", label: "Demo" },
];

export function Layout() {
  const { wsConnected, health, nodes } = useC2();
  const online = nodes.filter((a) => a.status === "online").length;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-soc-border bg-soc-panel flex flex-col">
        <div className="px-5 py-5 border-b border-soc-border">
          <div className="text-white font-semibold leading-tight">Aligo</div>
          <div className="text-xs text-soc-muted">Mission Ledger C2</div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-soc-accent/15 text-soc-accent"
                    : "text-soc-muted hover:text-white hover:bg-soc-panel2"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-soc-border text-xs text-soc-muted space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                wsConnected ? "bg-soc-ok" : "bg-soc-err"
              }`}
            />
            {wsConnected ? "Live" : "Disconnected"}
          </div>
          <div>
            Chain:{" "}
            <span
              className={
                health?.chain_status === "connected"
                  ? "text-soc-ok"
                  : "text-soc-warn"
              }
            >
              {health?.chain_status ?? (health?.ledger_available ? "connected" : "local")}
            </span>
          </div>
          {health?.contract_address && (
            <div className="font-mono truncate" title={health.contract_address}>
              {health.contract_address.slice(0, 10)}…
            </div>
          )}
          <div>{online} nodes online</div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="px-8 py-4 border-b border-soc-border bg-soc-panel/50 flex items-center justify-between">
          <div className="text-xs text-soc-muted">
            Authorized laboratory environment · safe plugins only
          </div>
          <div className="text-xs text-soc-muted">v{health?.version ?? "—"}</div>
        </div>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
