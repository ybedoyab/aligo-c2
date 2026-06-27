import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import {
  CloseIcon,
  ConsoleIcon,
  DashboardIcon,
  IoTLabIcon,
  LedgerIcon,
  MenuIcon,
  MissionsIcon,
  NodesIcon,
  ShieldIcon,
  TopologyIcon,
  type NavIcon,
} from "./icons";
import { LanguageSwitcher } from "./LanguageSwitcher";

const SIDEBAR_KEY = "aligo-sidebar";

function readSidebarOpen(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) return stored === "open";
  } catch {
    /* ignore */
  }
  return true;
}

export function Layout() {
  const { t, status } = useI18n();
  const { wsConnected, health, nodes } = useC2();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const online = nodes.filter((a) => a.status === "online").length;

  const nav: { to: string; label: string; end?: boolean; icon: NavIcon }[] = [
    { to: "/", label: t("nav.dashboard"), end: true, icon: DashboardIcon },
    { to: "/nodes", label: t("nav.nodes"), icon: NodesIcon },
    { to: "/topology", label: t("nav.topology"), icon: TopologyIcon },
    { to: "/iot-lab", label: t("nav.iotLab"), icon: IoTLabIcon },
    { to: "/missions", label: t("nav.missions"), icon: MissionsIcon },
    { to: "/vulnerabilities", label: t("nav.vulnerabilities"), icon: ShieldIcon },
    { to: "/console", label: t("nav.console"), icon: ConsoleIcon },
    { to: "/ledger", label: t("nav.ledger"), icon: LedgerIcon },
  ];

  const chainStatus =
    health?.chain_status ?? (health?.ledger_available ? "connected" : "local");

  const setSidebar = (open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed");
    } catch {
      /* ignore */
    }
  };

  const toggleSidebar = () => setSidebar(!sidebarOpen);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    if (mobile) setSidebar(false);
  }, [location.pathname]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    document.body.style.overflow = sidebarOpen && mobile ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 app-overlay"
          onClick={() => setSidebar(false)}
          aria-label={t("layout.closeMenu")}
        />
      )}

      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 w-60 max-w-[85vw] shrink-0 flex flex-col transition-transform duration-300 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-soc-borderSubtle flex items-start justify-between gap-3 bg-gradient-to-r from-soc-brand/10 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-soc-brand/25 to-soc-brand3/20 text-soc-brand border border-soc-brand/35 shadow-[0_0_16px_rgba(244,63,94,0.15)]">
              <ShieldIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold leading-tight">Aligo</div>
              <div className="text-xs text-soc-muted">{t("layout.subtitle")}</div>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn shrink-0"
            onClick={() => setSidebar(false)}
            aria-label={t("layout.closeMenu")}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {nav.map((item, index) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={{ animationDelay: `${index * 30}ms` }}
                className={({ isActive }) =>
                  `nav-link animate-slide-in-left ${isActive ? "nav-link-active" : "nav-link-idle"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        isActive ? "text-soc-brand scale-110" : "opacity-75"
                      }`}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-soc-borderSubtle text-xs text-soc-muted space-y-1 shrink-0 bg-gradient-to-t from-soc-bg/80 to-transparent">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                wsConnected ? "bg-soc-ok animate-pulse-soft" : "bg-soc-err"
              }`}
            />
            {wsConnected ? t("layout.live") : t("layout.disconnected")}
          </div>
          <div>
            {t("layout.chain")}:{" "}
            <span
              className={
                health?.chain_status === "connected"
                  ? "text-soc-ok"
                  : "text-soc-warn"
              }
            >
              {status(chainStatus)}
            </span>
          </div>
          {health?.contract_address && (
            <div className="font-mono truncate" title={health.contract_address}>
              {health.contract_address.slice(0, 10)}…
            </div>
          )}
          <div>{t("layout.nodesOnline", { count: online })}</div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="app-header sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3">
          <button
            type="button"
            className="icon-btn shrink-0"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? t("layout.closeMenu") : t("layout.openMenu")}
            aria-expanded={sidebarOpen}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 text-xs text-soc-muted truncate hidden sm:block">
            {t("layout.disclaimer")}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-auto sm:ml-0">
            <LanguageSwitcher />
            <div className="text-xs text-soc-muted tabular-nums">v{health?.version ?? "—"}</div>
          </div>
        </header>

        <div className="sm:hidden px-4 py-2 border-b border-soc-borderSubtle bg-soc-panel/60 text-xs text-soc-muted">
          {t("layout.disclaimer")}
        </div>

        <div key={location.pathname} className="flex-1 p-4 sm:p-6 lg:p-8 page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
