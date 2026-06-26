export type AgentStatus = "online" | "offline" | "warning" | "error";
export type MissionStatus =
  | "draft"
  | "running"
  | "completed"
  | "failed"
  | "partially_failed";
export type TaskStatus =
  | "pending"
  | "sent"
  | "running"
  | "success"
  | "failed"
  | "timeout";

export type OnChainStatus = "disabled" | "pending_chain" | "confirmed";

export interface Agent {
  id: string;
  hostname: string;
  os: string;
  username: string;
  status: AgentStatus;
  health_score: number;
  first_seen: string;
  last_seen: string;
  registered_at: string;
}

export interface MissionStep {
  plugin: string;
  args: Record<string, unknown>;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  status: MissionStatus;
  steps: MissionStep[];
  target_agent_ids: string[];
  is_predefined: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Task {
  id: string;
  mission_id: string;
  agent_id: string;
  plugin: string;
  args: Record<string, unknown>;
  status: TaskStatus;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
}

export interface Result {
  id: string;
  task_id: string;
  mission_id: string;
  agent_id: string;
  status: TaskStatus;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  result_metadata: Record<string, unknown>;
  created_at: string;
}

export type EventType =
  | "AGENT_REGISTERED"
  | "MISSION_CREATED"
  | "MISSION_STARTED"
  | "TASK_SENT"
  | "TASK_RESULT"
  | "TASK_FAILED"
  | "MISSION_COMPLETED"
  | "AGENT_DISCONNECTED"
  | "AGENT_RECONNECTED";

export interface LedgerEvent {
  id: string;
  sequence: number | null;
  mission_id: string;
  task_id: string;
  agent_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  payload_hash: string;
  previous_hash: string;
  timestamp: string;
  onchain_status: OnChainStatus;
  tx_hash: string | null;
  block_number: number | null;
  created_at: string;
}

export interface VerifyResult {
  event_id: string;
  local_hash: string;
  recomputed_hash: string;
  onchain_hash: string | null;
  local_match: boolean;
  chain_match: boolean | null;
  verified: boolean;
  status: "verified" | "tampered" | "pending_chain";
  detail: string;
}

export const ALLOWED_PLUGINS = [
  "system_info",
  "health_check",
  "echo",
  "list_lab_directory",
  "network_info",
  "allowed_command",
] as const;

export type PluginName = (typeof ALLOWED_PLUGINS)[number];

export interface WsMessage {
  type:
    | "connected"
    | "agent_update"
    | "task_update"
    | "result"
    | "mission_update"
    | "ledger_event"
    | "pong";
  data?: unknown;
}
