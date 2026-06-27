import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import type { Node as FleetNode } from "../types";
import { HealthBadge, StatusBadge } from "./HealthBadge";
import { BlockchainIcon, NodesIcon, OperatorIcon, ServerIcon, type NavIcon } from "./icons";
import { TopologyConnector, TopologyStage } from "./TopologyStage";

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

      {steps.map((step, index) => (
        <div key={step.id}>
          <TopologyStage
            label={step.label}
            description={step.description}
            Icon={step.Icon}
            accentClass={step.accentClass}
            iconClass={step.iconClass}
            animationDelayMs={index * STEP_ANIMATION_DELAY_MS}
          >
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
          </TopologyStage>
          {index < steps.length - 1 ? <TopologyConnector /> : null}
        </div>
      ))}
    </section>
  );
}
