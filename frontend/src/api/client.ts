import type {
  Agent,
  LedgerEvent,
  Mission,
  MissionStep,
  Result,
  Task,
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
}

export const api = {
  health: () => http<HealthInfo>("/health"),

  listAgents: () => http<Agent[]>("/api/agents"),
  getAgent: (id: string) => http<Agent>(`/api/agents/${id}`),

  listMissions: () => http<Mission[]>("/api/missions"),
  getMission: (id: string) => http<Mission>(`/api/missions/${id}`),
  createMission: (payload: {
    name: string;
    description: string;
    steps: MissionStep[];
    target_agent_ids: string[];
  }) =>
    http<Mission>("/api/missions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  startMission: (id: string, target_agent_ids?: string[]) =>
    http<{ mission: Mission; tasks: Task[] }>(`/api/missions/${id}/start`, {
      method: "POST",
      body: JSON.stringify({ target_agent_ids: target_agent_ids ?? null }),
    }),

  listTasks: (missionId?: string) =>
    http<Task[]>(`/api/tasks${missionId ? `?mission_id=${missionId}` : ""}`),
  createTask: (payload: {
    agent_id: string;
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

  listLedger: () => http<LedgerEvent[]>("/api/ledger/events"),
  getLedgerEvent: (id: string) => http<LedgerEvent>(`/api/ledger/events/${id}`),
  verifyLedgerEvent: (id: string) =>
    http<VerifyResult>(`/api/ledger/events/${id}/verify`, { method: "POST" }),

  startSampleMission: () =>
    http<{ mission: Mission; tasks: Task[]; targets: string[] }>(
      "/api/demo/start-sample-mission",
      { method: "POST" }
    ),
};
