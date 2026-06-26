import type { Agent } from "../types";
import { timeAgo } from "../utils";
import { HealthBadge, StatusBadge } from "./HealthBadge";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-sm text-white">{agent.id}</div>
          <div className="text-xs text-soc-muted">{agent.hostname || "unknown host"}</div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-soc-muted">
        <span>OS</span>
        <span className="text-right text-white truncate">{agent.os || "-"}</span>
        <span>User</span>
        <span className="text-right text-white truncate">{agent.username || "-"}</span>
        <span>Last seen</span>
        <span className="text-right text-white">{timeAgo(agent.last_seen)}</span>
      </div>
      <HealthBadge score={agent.health_score} />
    </div>
  );
}
