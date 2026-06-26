export type NodeStatus = "online" | "offline" | "warning" | "error";
export type NodeType = "real" | "simulated" | "ai_analyst";
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
  | "timeout"
  | "blocked_by_policy";

export type OnChainStatus =
  | "disabled"
  | "pending_chain"
  | "confirmed"
  | "anchored";

export type ChainStatus =
  | "connected"
  | "contract_not_configured"
  | "disconnected"
  | "local_only";

export type IntegrityStatus =
  | "verified"
  | "pending_chain"
  | "tampered"
  | "local_only"
  | "unknown";

export interface Node {
  id: string;
  hostname: string;
  os: string;
  username: string;
  status: NodeStatus;
  health_score: number;
  first_seen: string;
  last_seen: string;
  registered_at: string;
  alias: string;
  tags: string[];
  group: string;
  description: string;
  enabled: boolean;
  trusted: boolean;
  node_type: NodeType;
  policy_id: string;
}

export interface NodeUpdate {
  alias?: string;
  tags?: string[];
  group?: string;
  description?: string;
  enabled?: boolean;
  trusted?: boolean;
  node_type?: NodeType;
  policy_id?: string;
}

export interface NodePolicy {
  id: string;
  name: string;
  description: string;
  plugins: string[];
}

export interface NodeHealthFactor {
  label: string;
  score: number;
  detail: string;
}

export interface NodeHealthExplanation {
  total_score: number;
  factors: NodeHealthFactor[];
}

export interface NodeStats {
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
}

export interface NodeTaskHistoryRow {
  task_id: string;
  mission_id: string;
  plugin: string;
  args: Record<string, unknown>;
  status: TaskStatus;
  duration_ms: number | null;
  exit_code: number | null;
  created_at: string;
  completed_at: string | null;
  ledger_event_id: string | null;
  integrity_status: IntegrityStatus;
}

export interface NodeDetail {
  node: Node;
  stats: NodeStats;
  last_heartbeat: string;
  health: NodeHealthExplanation;
  tasks: NodeTaskHistoryRow[];
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
  target_node_ids: string[];
  is_predefined: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Task {
  id: string;
  mission_id: string;
  node_id: string;
  plugin: string;
  args: Record<string, unknown>;
  status: TaskStatus;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
}

export interface TaskEvidence {
  task_id: string;
  node_id: string;
  mission_id: string;
  mission_name: string | null;
  plugin: string;
  args: Record<string, unknown>;
  status: TaskStatus;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  duration_ms: number | null;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
  local_hash: string | null;
  previous_hash: string | null;
  ledger_event_id: string | null;
  blockchain_tx_hash: string | null;
  block_number: number | null;
  on_chain_status: OnChainStatus | null;
  integrity_status: IntegrityStatus;
  result_id: string | null;
}

export interface Result {
  id: string;
  task_id: string;
  mission_id: string;
  node_id: string;
  status: TaskStatus;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  result_metadata: Record<string, unknown>;
  created_at: string;
}

export type EventType =
  | "NODE_REGISTERED"
  | "MISSION_CREATED"
  | "MISSION_STARTED"
  | "TASK_SENT"
  | "TASK_RESULT"
  | "TASK_FAILED"
  | "MISSION_COMPLETED"
  | "NODE_DISCONNECTED"
  | "NODE_RECONNECTED"
  | "PLUGIN_BLOCKED";

export interface LedgerEvent {
  id: string;
  sequence: number | null;
  mission_id: string;
  task_id: string;
  node_id: string;
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

export interface ChainStatusInfo {
  status: ChainStatus;
  ledger_enabled: boolean;
  contract_address: string | null;
  rpc_url: string;
  client_available: boolean;
  detail: string;
}

export interface LedgerStats {
  total_events: number;
  anchored_on_chain: number;
  pending_chain: number;
  verified: number;
  tampered: number;
  chain: ChainStatusInfo;
}

export interface AnchorResult {
  event_id: string;
  success: boolean;
  onchain_status?: OnChainStatus;
  tx_hash?: string | null;
  block_number?: number | null;
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
    | "node_update"
    | "task_update"
    | "result"
    | "mission_update"
    | "ledger_event"
    | "pong";
  data?: unknown;
}

export interface ConsoleHistoryEntry {
  id: string;
  timestamp: string;
  target: string;
  plugin: string;
  task_id: string;
  status: TaskStatus | "dispatching";
  duration_ms?: number;
}
