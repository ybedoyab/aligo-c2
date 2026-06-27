import { Link } from "react-router-dom";
import { HealthBadge, StatusBadge } from "../components/HealthBadge";
import {
  BlockchainIcon,
  DeviceIcon,
  GaugeIcon,
  IoTLabIcon,
  NodesIcon,
  OperatorIcon,
  ServerIcon,
} from "../components/icons";
import { TopologyConnector, TopologyStage } from "../components/TopologyStage";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { IoTDevice, Node as FleetNode } from "../types";

const GATEWAY_ID = "gateway-sim-001";
const ROUTE = {
  IOT_LAB: "/iot-lab",
  LEDGER: "/ledger",
  NODES: "/nodes",
} as const;
const STATUS = {
  ONLINE: "online",
} as const;
const ANIMATION_DELAY_MS = 55;

export function Topology() {
  const { t, status } = useI18n();
  const { nodes, health } = useC2();
  const onlineNodes = nodes.filter(
    (node) => node.status === STATUS.ONLINE && node.enabled
  );
  const computerNodes = onlineNodes.filter(
    (node) => node.node_type !== "iot_gateway" && !node.id.startsWith("gateway-")
  );
  const gateway = onlineNodes.find(
    (node) => node.id === GATEWAY_ID || node.node_type === "iot_gateway"
  );
  const iotDevices = gateway?.iot_devices ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">{t("topology.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-soc-muted">{t("topology.description")}</p>
      </header>

      <section className="card p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <TopologyStage
            label={t("topology.operatorUi")}
            description={t("topology.reactWs")}
            Icon={OperatorIcon}
            accentClass="border-soc-accent/30"
            iconClass="border-soc-accent/40 text-soc-accent"
            className="mx-auto max-w-xl"
          />

          <TopologyConnector className="mx-auto" colorClass="from-soc-accent/70 to-soc-brand/60" />

          <TopologyStage
            label={t("topology.c2Server")}
            description={t("topology.versionNodes", {
              version: health?.version ?? t("common.dash"),
              count: onlineNodes.length,
            })}
            Icon={ServerIcon}
            accentClass="border-soc-brand/30"
            iconClass="border-soc-brand/40 text-soc-brand animate-pulse-soft"
            animationDelayMs={ANIMATION_DELAY_MS}
            className="mx-auto max-w-xl"
          />

          <BranchConnector />

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 sm:gap-6">
            <TopologyStage
              label={t("topology.computerNodes")}
              description={t("topology.activeComputerNodes", { count: computerNodes.length })}
              Icon={NodesIcon}
              accentClass="border-soc-ok/30"
              iconClass="border-soc-ok/40 text-soc-ok"
              animationDelayMs={ANIMATION_DELAY_MS * 2}
              className="h-full"
            >
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {computerNodes.length === 0 ? (
                  <EmptyState message={t("topology.noComputerNodes")} />
                ) : (
                  computerNodes.map((node, index) => (
                    <ComputerNode key={node.id} node={node} index={index} />
                  ))
                )}
              </div>
            </TopologyStage>

            <TopologyStage
              label={t("topology.iotGateway")}
              description={
                gateway
                  ? t("topology.connectedDevices", { count: iotDevices.length })
                  : t("status.disconnected")
              }
              Icon={IoTLabIcon}
              accentClass="border-amber-400/30"
              iconClass="border-amber-400/40 text-amber-300"
              animationDelayMs={ANIMATION_DELAY_MS * 3}
              className="h-full"
            >
              <div className="mt-4">
                {gateway ? (
                  <IoTGateway gateway={gateway} devices={iotDevices} />
                ) : (
                  <EmptyState message={t("topology.gatewayOffline")} />
                )}
              </div>
            </TopologyStage>
          </div>

          <TopologyConnector className="mx-auto" colorClass="from-soc-brand/60 to-soc-accent2/70" />

          <TopologyStage
            label={t("topology.blockchainLedger")}
            description={health?.contract_address?.slice(0, 18) ?? status("local")}
            Icon={BlockchainIcon}
            accentClass="border-soc-accent2/30"
            iconClass="border-soc-accent2/40 text-soc-accent2"
            animationDelayMs={ANIMATION_DELAY_MS * 4}
            className="mx-auto max-w-xl"
          >
            <Link
              to={ROUTE.LEDGER}
              className="mt-3 inline-flex text-xs text-soc-accent hover:underline"
            >
              {t("topology.openLedger")}
            </Link>
          </TopologyStage>
        </div>
      </section>
    </div>
  );
}

function BranchConnector() {
  return (
    <div className="relative mx-auto h-12 max-w-[52rem]" aria-hidden="true">
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-soc-brand/60 sm:h-1/2" />
      <div className="absolute left-1/4 right-1/4 top-1/2 hidden h-px bg-gradient-to-r from-soc-ok/60 via-soc-brand/60 to-amber-400/60 sm:block" />
      <div className="absolute left-1/4 top-1/2 hidden h-1/2 w-px bg-soc-ok/60 sm:block" />
      <div className="absolute right-1/4 top-1/2 hidden h-1/2 w-px bg-amber-400/60 sm:block" />
    </div>
  );
}

function ComputerNode({ node, index }: { node: FleetNode; index: number }) {
  return (
    <Link
      to={`${ROUTE.NODES}/${node.id}`}
      className="group flex animate-slide-in-left items-center gap-3 rounded-lg border border-soc-borderSubtle bg-soc-bg/50 p-3 transition-colors hover:border-soc-ok/50"
      style={{ animationDelay: `${index * ANIMATION_DELAY_MS}ms`, animationFillMode: "both" }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-soc-ok/30 bg-soc-ok/10 text-soc-ok transition-transform group-hover:scale-105">
        <DeviceIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-white">{node.alias || node.id}</div>
        <div className="truncate text-[11px] text-soc-muted">{node.os}</div>
      </div>
      <div className="hidden sm:block">
        <HealthBadge score={node.health_score} />
      </div>
    </Link>
  );
}

function IoTGateway({ gateway, devices }: { gateway: FleetNode; devices: IoTDevice[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <Link
        to={ROUTE.IOT_LAB}
        className="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 transition-colors hover:bg-amber-400/10"
      >
        <ServerIcon className="h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs text-white">{gateway.id}</div>
          <div className="truncate text-[11px] text-soc-muted">{gateway.policy_id}</div>
        </div>
        <StatusBadge status={gateway.status} />
      </Link>

      <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 min-[420px]:grid-cols-2">
        {devices.map((device, index) => (
          <IoTDeviceCard key={device.device_id} device={device} index={index} />
        ))}
        {devices.length === 0 ? <EmptyState message={t("topology.noIotDevices")} /> : null}
      </div>
    </div>
  );
}

function IoTDeviceCard({ device, index }: { device: IoTDevice; index: number }) {
  const { t } = useI18n();
  const actuator = device.device_type === "actuator";
  const Icon = actuator ? IoTLabIcon : GaugeIcon;
  const type = actuator ? "actuator" : "sensor";
  const colorClass = actuator ? "text-emerald-300" : "text-cyan-300";

  return (
    <div
      className="flex animate-slide-up items-center gap-2 rounded-lg border border-soc-borderSubtle bg-soc-bg/50 p-2.5"
      style={{ animationDelay: `${index * ANIMATION_DELAY_MS}ms`, animationFillMode: "both" }}
    >
      <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />
      <div className="min-w-0">
        <div className="truncate font-mono text-[10px] text-white">{device.device_id}</div>
        <div className="text-[9px] uppercase text-soc-muted">{t(`nodeType.${type}`)}</div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-soc-border px-3 py-6 text-center text-xs text-soc-muted">
      {message}
    </div>
  );
}
