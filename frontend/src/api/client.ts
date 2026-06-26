import type {
  Node,
  NodeDetail,
  NodePolicy,
  NodeUpdate,
  AnchorResult,
  ChainStatusInfo,
  EvidenceBundle,
  EvidenceVerifyResult,
  LedgerEvent,
  LedgerStats,
  IoTLabState,
  Mission,
  MissionDryRun,
  MissionStep,
  Result,
  Task,
  TaskEvidence,
  VerifyResult,
} from "../types";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

function wsBase(): string {
  return API_URL.replace(/^http/, "ws");
}

export const OPERATOR_WS_URL = `${wsBase()}/ws/operator`;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.json();
      const d = body.detail;
      if (typeof d === "string") detail = d;
      else if (d && typeof d === "object" && "message" in d)
        detail = String((d as { message: string }).message);
      else detail = JSON.stringify(d ?? body);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface HealthInfo {
  status: string;
  version: string;
  ledger_enabled: boolean;
  ledger_available: boolean;
  ledger_detail: string;
  chain_status?: string;
  contract_address?: string | null;
}

export const api = {
  health: () => http<HealthInfo>("/health"),

  listNodes: (opts?: {
    status?: string;
    os?: string;
    group?: string;
    tag?: string;
    min_health?: number;
  }) => {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.os) params.set("os", opts.os);
    if (opts?.group) params.set("group", opts.group);
    if (opts?.tag) params.set("tag", opts.tag);
    if (opts?.min_health != null) params.set("min_health", String(opts.min_health));
    const q = params.toString();
    return http<Node[]>(`/api/nodes${q ? `?${q}` : ""}`);
  },
  getNode: (id: string) => http<Node>(`/api/nodes/${id}`),
  updateNode: (id: string, patch: NodeUpdate) =>
    http<Node>(`/api/nodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteNode: (id: string) =>
    http<void>(`/api/nodes/${id}`, { method: "DELETE" }),
  getNodeDetail: (id: string) => http<NodeDetail>(`/api/nodes/${id}/detail`),
  listPolicies: () => http<NodePolicy[]>("/api/policies"),

  listMissions: () => http<Mission[]>("/api/missions"),
  getMission: (id: string) => http<Mission>(`/api/missions/${id}`),
  createMission: (payload: {
    name: string;
    description: string;
    steps: MissionStep[];
    target_node_ids: string[];
  }) =>
    http<Mission>("/api/missions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  startMission: (id: string, target_node_ids?: string[]) =>
    http<{ mission: Mission; tasks: Task[] }>(`/api/missions/${id}/start`, {
      method: "POST",
      body: JSON.stringify({ target_node_ids: target_node_ids ?? null }),
    }),

  listTasks: (opts?: { missionId?: string; nodeId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.missionId) params.set("mission_id", opts.missionId);
    if (opts?.nodeId) params.set("node_id", opts.nodeId);
    const q = params.toString();
    return http<Task[]>(`/api/tasks${q ? `?${q}` : ""}`);
  },
  getTaskEvidence: (taskId: string) =>
    http<TaskEvidence>(`/api/tasks/${taskId}/evidence`),
  getEvidenceBundle: (taskId: string) =>
    http<EvidenceBundle>(`/api/tasks/${taskId}/evidence/bundle`),
  verifyEvidenceBundle: (bundle: Record<string, unknown>) =>
    http<EvidenceVerifyResult>("/api/evidence/verify", {
      method: "POST",
      body: JSON.stringify({ bundle }),
    }),
  dryRunMission: (missionId: string, target_node_ids?: string[]) =>
    http<MissionDryRun>(`/api/missions/${missionId}/dry-run`, {
      method: "POST",
      body: JSON.stringify({ target_node_ids: target_node_ids ?? null }),
    }),
  createTask: (payload: {
    node_id: string;
    plugin: string;
    args: Record<string, unknown>;
    mission_id?: string;
  }) =>
    http<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listResults: (missionId?: string) =>
    http<Result[]>(`/api/results${missionId ? `?mission_id=${missionId}` : ""}`),

  ledgerStatus: () => http<ChainStatusInfo>("/api/ledger/status"),
  ledgerStats: () => http<LedgerStats>("/api/ledger/stats"),
  listLedger: () => http<LedgerEvent[]>("/api/ledger/events"),
  getLedgerEvent: (id: string) => http<LedgerEvent>(`/api/ledger/events/${id}`),
  verifyLedgerEvent: (id: string) =>
    http<VerifyResult>(`/api/ledger/events/${id}/verify`, { method: "POST" }),
  anchorLedgerEvent: (id: string) =>
    http<AnchorResult>(`/api/ledger/events/${id}/anchor`, { method: "POST" }),
  anchorPendingLedger: () =>
    http<AnchorResult[]>("/api/ledger/anchor-pending", { method: "POST" }),

  startSampleMission: () =>
    http<{ mission: Mission; tasks: Task[]; targets: string[] }>(
      "/api/demo/start-sample-mission",
      { method: "POST" }
    ),

  simulateTamper: (task_id: string) =>
    http<{
      task_id: string;
      ledger_event_id: string;
      verify_status: string;
      verified: boolean;
      detail: string;
      diff?: Array<{ field: string; original: string; current: string }>;
    }>("/api/demo/simulate-tamper", {
      method: "POST",
      body: JSON.stringify({ task_id }),
    }),

  getIoTLab: () => http<IoTLabState>("/api/iot/lab"),

  runIoTAction: (payload: {
    plugin: string;
    args?: Record<string, unknown>;
    gateway_id?: string;
  }) =>
    http<Task>("/api/iot/actions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  startIoTHealthCheck: () =>
    http<{ mission: Mission; tasks: Task[]; targets: string[] }>(
      "/api/demo/start-iot-health-check",
      { method: "POST" }
    ),

  runEnvironmentalSnapshot: () =>
    http<{ mission: Mission; tasks: Task[]; targets: string[] }>(
      "/api/demo/run-environmental-snapshot",
      { method: "POST" }
    ),

  blinkLed: () =>
    http<{ task: Task }>("/api/demo/blink-led", { method: "POST" }),

  verifyLatestIoTEvent: () =>
    http<{
      task_id: string;
      plugin: string;
      device_id?: string;
      ledger_event_id: string;
      verify_status: string;
      verified: boolean;
      detail: string;
    }>("/api/demo/verify-latest-iot-event", { method: "POST" }),

  exportIoTEvidence: () =>
    http<{ gateway: string; count: number; evidence: EvidenceBundle[] }>(
      "/api/demo/export-iot-evidence"
    ),

  exportMissionReport: async (
    missionId: string,
    format: "json" | "markdown" = "json",
    save = false
  ) => {
    const params = new URLSearchParams({ format, save: String(save) });
    const res = await fetch(`${API_URL}/api/missions/${missionId}/report?${params}`);
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    if (format === "markdown") {
      return { markdown: await res.text() };
    }
    return (await res.json()) as {
      report: Record<string, unknown>;
      saved_paths?: Record<string, string>;
    };
  },
};
