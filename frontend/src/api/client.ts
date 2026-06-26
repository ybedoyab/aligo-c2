import type {
  Node,
  NodeDetail,
  AnchorResult,
  ChainStatusInfo,
  LedgerEvent,
  LedgerStats,
  Mission,
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
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* ignore */
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

  listNodes: () => http<Node[]>("/api/nodes"),
  getNode: (id: string) => http<Node>(`/api/nodes/${id}`),
  getNodeDetail: (id: string) => http<NodeDetail>(`/api/nodes/${id}/detail`),

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
};
