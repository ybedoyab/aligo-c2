import { Link } from "react-router-dom";
import type { Node } from "../types";
import { useI18n } from "../i18n";
import { HealthBadge, NodeMetaBadges, StatusBadge } from "./HealthBadge";

export function NodeCard({ node }: { node: Node }) {
  const { t, timeAgo } = useI18n();
  const label = node.alias || node.id;
  return (
    <Link
      to={`/nodes/${node.id}`}
      className="card-interactive p-4 flex flex-col gap-3 block"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-sm text-white truncate">{label}</div>
          {node.alias && (
            <div className="text-xs text-soc-muted font-mono truncate">{node.id}</div>
          )}
          <div className="text-xs text-soc-muted">{node.hostname || t("nodes.unknownHost")}</div>
        </div>
        <StatusBadge status={node.enabled ? node.status : "disabled"} />
      </div>
      <NodeMetaBadges
        enabled={node.enabled}
        trusted={node.trusted}
        nodeType={node.node_type}
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-soc-muted">
        <span>{t("nodes.os")}</span>
        <span className="text-right text-white truncate">{node.os || t("common.dash")}</span>
        <span>{t("nodes.group")}</span>
        <span className="text-right text-white truncate">{node.group || t("common.dash")}</span>
        <span>{t("nodes.policy")}</span>
        <span className="text-right text-white truncate">{node.policy_id}</span>
        <span>{t("nodes.lastSeen")}</span>
        <span className="text-right text-white">{timeAgo(node.last_seen)}</span>
      </div>
      <HealthBadge score={node.health_score} />
    </Link>
  );
}
