import { Link } from "react-router-dom";
import type { Node } from "../types";
import { timeAgo } from "../utils";
import { HealthBadge, NodeMetaBadges, StatusBadge } from "./HealthBadge";

export function NodeCard({ node }: { node: Node }) {
  const label = node.alias || node.id;
  return (
    <Link
      to={`/nodes/${node.id}`}
      className="card p-4 flex flex-col gap-3 hover:border-soc-accent transition-colors block"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-sm text-white truncate">{label}</div>
          {node.alias && (
            <div className="text-xs text-soc-muted font-mono truncate">{node.id}</div>
          )}
          <div className="text-xs text-soc-muted">{node.hostname || "unknown host"}</div>
        </div>
        <StatusBadge status={node.enabled ? node.status : "disabled"} />
      </div>
      <NodeMetaBadges
        enabled={node.enabled}
        trusted={node.trusted}
        nodeType={node.node_type}
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-soc-muted">
        <span>OS</span>
        <span className="text-right text-white truncate">{node.os || "-"}</span>
        <span>Group</span>
        <span className="text-right text-white truncate">{node.group || "-"}</span>
        <span>Policy</span>
        <span className="text-right text-white truncate">{node.policy_id}</span>
        <span>Last seen</span>
        <span className="text-right text-white">{timeAgo(node.last_seen)}</span>
      </div>
      <HealthBadge score={node.health_score} />
    </Link>
  );
}
