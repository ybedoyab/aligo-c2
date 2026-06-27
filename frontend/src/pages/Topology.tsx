import { Link } from "react-router-dom";
import { HealthBadge, StatusBadge } from "../components/HealthBadge";
import { useI18n } from "../i18n";
import { useC2 } from "../store";

const GATEWAY_ID = "gateway-sim-001";

export function Topology() {
  const { t, status } = useI18n();
  const { nodes, health } = useC2();
  const online = nodes.filter((n) => n.status === "online" && n.enabled);
  const computerNodes = online.filter(
    (n) => n.node_type !== "iot_gateway" && !n.id.startsWith("gateway-")
  );
  const gateway = online.find((n) => n.id === GATEWAY_ID || n.node_type === "iot_gateway");
  const iotDevices = gateway?.iot_devices ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("topology.title")}</h1>
        <p className="text-sm text-soc-muted">{t("topology.description")}</p>
      </div>

      <div className="card p-6 space-y-6">
        <div className="flex flex-col items-center gap-2">
          <TopoNode
            title={t("topology.operatorUi")}
            badge={t("topology.dashboardBadge")}
            subtitle={t("topology.reactWs")}
          />
          <span className="text-soc-muted">↓</span>
          <TopoNode
            title={t("topology.c2Server")}
            badge={t("topology.serverBadge")}
            subtitle={t("topology.versionNodes", {
              version: health?.version ?? "—",
              count: online.length,
            })}
          />
          <span className="text-soc-muted">↓</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">{t("topology.computerNodes")}</h3>
            {computerNodes.length === 0 ? (
              <p className="text-xs text-soc-muted">{t("topology.noComputerNodes")}</p>
            ) : (
              <div className="space-y-2">
                {computerNodes.map((n) => (
                  <Link
                    key={n.id}
                    to={`/nodes/${n.id}`}
                    className="flex items-center justify-between border border-soc-border rounded p-2 hover:border-soc-brand text-sm"
                  >
                    <span className="font-mono">{n.alias || n.id}</span>
                    <TypeBadge type="computer" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              {t("topology.iotGateway")}
              <TypeBadge type="gateway" />
            </h3>
            {gateway ? (
              <>
                <Link
                  to="/iot-lab"
                  className="text-sm font-mono text-soc-accent hover:underline"
                >
                  {gateway.id}
                </Link>
                <p className="text-xs text-soc-muted mt-1">{gateway.policy_id}</p>
                <div className="mt-3 pl-4 border-l border-soc-border space-y-2">
                  {iotDevices.map((d) => (
                    <div key={d.device_id} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-white">{d.device_id}</span>
                      <div className="flex gap-1">
                        <TypeBadge type={d.device_type === "actuator" ? "actuator" : "sensor"} />
                        <span className="text-[10px] text-amber-300/80 uppercase">
                          {t("nodeType.simulated")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-soc-muted">{t("topology.gatewayOffline")}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          <span className="text-soc-muted">↓</span>
          <TopoNode
            title={t("topology.blockchainLedger")}
            badge={t("topology.ledgerBadge")}
            subtitle={health?.contract_address?.slice(0, 14) ?? status("local")}
            href="/ledger"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {online.map((n) => (
          <Link
            key={n.id}
            to={n.node_type === "iot_gateway" ? "/iot-lab" : `/nodes/${n.id}`}
            className="card-interactive p-4"
          >
            <div className="flex justify-between">
              <span className="font-mono text-sm">{n.alias || n.id}</span>
              <StatusBadge status={n.status} />
            </div>
            <p className="text-xs text-soc-muted mt-1">{n.os}</p>
            <HealthBadge score={n.health_score} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function TopoNode({
  title,
  subtitle,
  badge,
  href,
}: {
  title: string;
  subtitle: string;
  badge: string;
  href?: string;
}) {
  const inner = (
    <div className="surface-inset rounded-lg px-4 sm:px-6 py-4 text-center w-full max-w-xs sm:min-w-[200px]">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-xs text-soc-muted">{subtitle}</div>
      <span className="text-[10px] uppercase text-soc-brand mt-1 inline-block">{badge}</span>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function TypeBadge({ type }: { type: "computer" | "gateway" | "sensor" | "actuator" }) {
  const { t } = useI18n();
  const colors: Record<string, string> = {
    computer: "text-sky-300 border-sky-500/40",
    gateway: "text-amber-300 border-amber-500/40",
    sensor: "text-cyan-300 border-cyan-500/40",
    actuator: "text-emerald-300 border-emerald-500/40",
  };
  return (
    <span
      className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${colors[type] ?? ""}`}
    >
      {t(`nodeType.${type}`)}
    </span>
  );
}
