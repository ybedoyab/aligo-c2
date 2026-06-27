import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import type { Node as FleetNode } from "../types";
import { HealthBadge, StatusBadge } from "./HealthBadge";
import {
  BlockchainIcon,
  NodesIcon,
  OperatorIcon,
  ServerIcon,
  type NavIcon,
} from "./icons";

const TOPOLOGY_ROUTE = "/topology";
const NODE_ROUTE = "/nodes";
const MAX_VISIBLE_NODES = 6;
const STEP_ANIMATION_DELAY_MS = 90;
const TOPOLOGY_STEP_ID = {
  OPERATOR: "operator",
  SERVER: "server",
  NODES: "nodes",
  LEDGER: "ledger",
} as const;

type TopologyStepId = (typeof TOPOLOGY_STEP_ID)[keyof typeof TOPOLOGY_STEP_ID];

interface TopologyStepDefinition {
  id: TopologyStepId;
  label: string;
  description: string;
  Icon: NavIcon;
  accentClass: string;
  iconClass: string;
}

interface FleetTopologySummaryProps {
  onlineNodes: FleetNode[];
}

function getAnimationDelay(index: number) {
  return `${index * STEP_ANIMATION_DELAY_MS}ms`;
}

function TopologyConnector() {
  return (
    <div className="ml-[35px] h-8 w-px bg-gradient-to-b from-soc-brand/70 to-soc-accent2/40" />
  );
}

function TopologyStep({
  step,
  index,
  children,
}: {
  step: TopologyStepDefinition;
  index: number;
  children?: ReactNode;
}) {
  const { Icon } = step;

  return (
    <div
      className={`relative animate-slide-up rounded-xl border bg-soc-panel2/60 p-3 ${step.accentClass}`}
      style={{ animationDelay: getAnimationDelay(index), animationFillMode: "both" }}
    >
      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-soc-brand shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse-soft" />
      <div className="flex items-center gap-3 pr-5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-soc-bg/70 ${step.iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{step.label}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-soc-muted">
            {step.description}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function FleetTopologySummary({ onlineNodes }: FleetTopologySummaryProps) {
  const { t } = useI18n();
  const visibleNodes = onlineNodes.slice(0, MAX_VISIBLE_NODES);
  const steps: TopologyStepDefinition[] = [
    {
      id: TOPOLOGY_STEP_ID.OPERATOR,
      label: t("dashboard.operatorUi"),
      description: t("dashboard.operatorUiDescription"),
      Icon: OperatorIcon,
      accentClass: "border-soc-accent/30",
      iconClass: "border-soc-accent/40 text-soc-accent",
    },
    {
      id: TOPOLOGY_STEP_ID.SERVER,
      label: t("dashboard.c2Server"),
      description: t("dashboard.c2ServerDescription"),
      Icon: ServerIcon,
      accentClass: "border-soc-brand/30",
      iconClass: "border-soc-brand/40 text-soc-brand",
    },
    {
      id: TOPOLOGY_STEP_ID.NODES,
      label: t("dashboard.nodesOnlineCount", { count: onlineNodes.length }),
      description: t("dashboard.nodeFleetDescription"),
      Icon: NodesIcon,
      accentClass: "border-soc-ok/30",
      iconClass: "border-soc-ok/40 text-soc-ok animate-pulse-soft",
    },
    {
      id: TOPOLOGY_STEP_ID.LEDGER,
      label: t("dashboard.blockchainLedger"),
      description: t("dashboard.blockchainLedgerDescription"),
      Icon: BlockchainIcon,
      accentClass: "border-soc-accent2/30",
      iconClass: "border-soc-accent2/40 text-soc-accent2",
    },
  ];

  return (
    <section className="card h-full min-h-[32rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{t("dashboard.fleetTopology")}</h3>
        <Link to={TOPOLOGY_ROUTE} className="shrink-0 text-xs text-soc-accent hover:underline">
          {t("dashboard.openTopology")}
        </Link>
      </div>

      <div>
        {steps.map((step, index) => (
          <div key={step.id}>
            <TopologyStep step={step} index={index}>
              {step.id === TOPOLOGY_STEP_ID.NODES && visibleNodes.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {visibleNodes.map((node) => (
                    <Link
                      key={node.id}
                      to={`${NODE_ROUTE}/${node.id}`}
                      className="flex min-w-0 items-center gap-2 rounded-lg border border-soc-borderSubtle bg-soc-bg/50 px-2.5 py-2 text-xs transition-colors hover:border-soc-ok/50"
                    >
                      <StatusBadge status={node.status} />
                      <span className="min-w-0 flex-1 truncate font-mono text-white">
                        {node.alias || node.id}
                      </span>
                      <HealthBadge score={node.health_score} />
                    </Link>
                  ))}
                </div>
              ) : null}
            </TopologyStep>
            {index < steps.length - 1 ? <TopologyConnector /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
