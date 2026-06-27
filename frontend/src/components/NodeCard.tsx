import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import type { Node } from "../types";
import { HealthBadge, NodeMetaBadges, StatusBadge } from "./HealthBadge";
import {
  ArrowRightIcon,
  ClockIcon,
  DeviceIcon,
  GroupIcon,
  LedgerIcon,
  ServerIcon,
} from "./icons";

const NODE_ROUTE = "/nodes";

interface NodeCardProps {
  node: Node;
  animationDelayMs?: number;
}

interface NodeFactProps {
  icon: typeof DeviceIcon;
  label: string;
  value: string;
}

function NodeFact({ icon: Icon, label, value }: NodeFactProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-soc-muted" />
      <span className="sr-only">{label}</span>
      <span className="truncate text-soc-muted">{value}</span>
    </div>
  );
}

export function NodeCard({ node, animationDelayMs = 0 }: NodeCardProps) {
  const { t, timeAgo } = useI18n();
  const label = node.alias || node.id;

  return (
    <Link
      to={`${NODE_ROUTE}/${node.id}`}
      className="card-interactive group relative flex min-w-0 animate-slide-up flex-col gap-4 overflow-hidden p-4"
      style={{ animationDelay: `${animationDelayMs}ms`, animationFillMode: "both" }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-soc-brand/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-soc-brand/30 bg-soc-brand/10 text-soc-brand transition-transform group-hover:scale-105">
          <DeviceIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-semibold text-white">{label}</div>
          <div className="truncate font-mono text-xs text-soc-muted">{node.id}</div>
        </div>
        <StatusBadge status={node.enabled ? node.status : "disabled"} />
      </div>

      <NodeMetaBadges enabled={node.enabled} trusted={node.trusted} nodeType={node.node_type} />

      <div className="grid gap-2 rounded-lg border border-soc-borderSubtle bg-soc-bg/40 p-3 sm:grid-cols-2">
        <NodeFact
          icon={ServerIcon}
          label={t("nodes.host")}
          value={node.hostname || t("nodes.unknownHost")}
        />
        <NodeFact
          icon={DeviceIcon}
          label={t("nodes.os")}
          value={node.os || t("common.dash")}
        />
        <NodeFact
          icon={GroupIcon}
          label={t("nodes.group")}
          value={node.group || t("common.dash")}
        />
        <NodeFact
          icon={ClockIcon}
          label={t("nodes.lastSeen")}
          value={timeAgo(node.last_seen)}
        />
      </div>

      <div className="flex min-w-0 items-center gap-2 text-xs text-soc-muted">
        <LedgerIcon className="h-3.5 w-3.5 shrink-0" />
        <span>{t("nodes.policy")}</span>
        <span className="truncate font-mono text-white">{node.policy_id}</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-soc-borderSubtle pt-3">
        <HealthBadge score={node.health_score} />
        <span className="flex items-center gap-1 text-xs text-soc-accent transition-transform group-hover:translate-x-0.5">
          {t("nodes.viewDetails")}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
