export type NodeStatus = "online" | "offline" | "warning" | "error";
export type NodeType =
  | "real"
  | "simulated"
  | "computer_node"
  | "iot_gateway"
  | "iot_sensor"
  | "iot_actuator"
  | "ai_analyst";
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
  public_key?: string;
  fingerprint?: string;
  iot_snapshot?: Record<string, unknown> | null;
  iot_devices?: IoTDevice[] | null;
}

export interface IoTDevice {
  device_id: string;
  device_type: string;
  label: string;
  state: Record<string, unknown>;
  last_updated: string;
  status: string;
}

export interface IoTLabState {
  gateway_id: string;
  online: boolean;
  status: string;
  health_score: number;
  policy_id: string;
  last_seen: string | null;
  node_type: string;
  subdevice_count: number;
  devices: IoTDevice[];
  snapshot: Record<string, unknown>;
  telemetry: {
    temperature_c: number | null;
    humidity_pct: number | null;
    motion_detected: boolean | null;
    lux: number | null;
    led: Record<string, unknown> | null;
  };
  recent_events: Array<{
    task_id: string;
    plugin: string;
    args: Record<string, unknown>;
    status: string;
    device_id?: string;
    completed_at: string | null;
    stdout_preview?: string;
  }>;
  stats: Record<string, number>;
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
  node_id?: string;
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
  merkle_root?: string | null;
  merkle_root_tx?: string | null;
  merkle_root_block?: number | null;
  merkle_root_status?: string | null;
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

export interface CustodyStep {
  step: number;
  label: string;
  timestamp: string | null;
  status: string;
  detail: string;
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
  node_fingerprint?: string | null;
  node_public_key?: string | null;
  node_signature?: string | null;
  signature_status?: string | null;
  policy_decision?: Record<string, unknown> | null;
  evidence_hash?: string | null;
  mission_merkle_root?: string | null;
  merkle_proof?: string[] | null;
  merkle_proof_status?: string | null;
  chain_of_custody?: CustodyStep[];
  anchored_snapshot?: Record<string, unknown> | null;
  node_type?: string | null;
  device_id?: string | null;
  device_type?: string | null;
  evidence_class?: string | null;
  iot_summary?: {
    gateway: string;
    subdevice?: string | null;
    physical_style_action: string;
    simulated_execution: boolean;
    evidence_class: string;
  } | null;
}

export interface EvidenceBundle extends TaskEvidence {
  verification_summary?: Record<string, unknown>;
  ledger_payload?: Record<string, unknown> | null;
  signed_payload?: Record<string, unknown> | null;
}

export interface MissionDryRun {
  mission_id: string;
  ready: boolean;
  tasks_to_dispatch: number;
  blocked_count: number;
  ledger_connected: boolean;
  items: Array<{
    node_id: string;
    plugin: string;
    decision: string;
    reason: string;
    ready: boolean;
  }>;
  summary: string;
}

export interface EvidenceVerifyResult {
  status: string;
  checks: Array<{ check: string; pass: boolean | null; detail: string }>;
  diff: Array<{ field: string; original: string; current: string }>;
  summary: Record<string, unknown>;
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
  | "PLUGIN_BLOCKED"
  | "POLICY_BLOCKED"
  | "MISSION_MERKLE_ROOT";

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
  diff?: Array<{ field: string; original: string; current: string }>;
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
  "gateway_health",
  "list_devices",
  "get_device_info",
  "get_gateway_snapshot",
  "read_temperature",
  "read_humidity",
  "read_motion",
  "read_light",
  "led_on",
  "led_off",
  "led_blink",
  "led_set_brightness",
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
    | "iot_telemetry"
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
