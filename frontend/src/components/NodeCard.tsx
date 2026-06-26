import { Link } from "react-router-dom";
import type { Node } from "../types";
import { timeAgo } from "../utils";
import { HealthBadge, StatusBadge } from "./HealthBadge";

export function NodeCard({ node }: { node: Node }) {
  return (
    <Link
      to={`/nodes/${node.id}`}
      className="card p-4 flex flex-col gap-3 hover:border-soc-accent transition-colors block"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-sm text-white">{node.id}</div>
          <div className="text-xs text-soc-muted">{node.hostname || "unknown host"}</div>
        </div>
        <StatusBadge status={node.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-soc-muted">
        <span>OS</span>
        <span className="text-right text-white truncate">{node.os || "-"}</span>
        <span>User</span>
        <span className="text-right text-white truncate">{node.username || "-"}</span>
        <span>Last seen</span>
        <span className="text-right text-white">{timeAgo(node.last_seen)}</span>
      </div>
      <HealthBadge score={node.health_score} />
    </Link>
  );
}
