import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { OPERATOR_WS_URL, api, type HealthInfo } from "./api/client";
import type {
  Node,
  IoTDevice,
  LedgerEvent,
  Mission,
  Result,
  Task,
  WsMessage,
} from "./types";

interface IoTTelemetry {
  node_id: string;
  snapshot: Record<string, unknown>;
  devices: IoTDevice[];
}

interface C2State {
  nodes: Node[];
  missions: Mission[];
  tasks: Task[];
  results: Result[];
  ledger: LedgerEvent[];
  health: HealthInfo | null;
  wsConnected: boolean;
  iotTelemetry: IoTTelemetry | null;
  refreshAll: () => Promise<void>;
}

const C2Context = createContext<C2State | null>(null);

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}

export function C2Provider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [ledger, setLedger] = useState<LedgerEvent[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [iotTelemetry, setIotTelemetry] = useState<IoTTelemetry | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const refreshAll = useCallback(async () => {
    const [a, m, t, r, l, h] = await Promise.allSettled([
      api.listNodes(),
      api.listMissions(),
      api.listTasks(),
      api.listResults(),
      api.listLedger(),
      api.health(),
    ]);
    if (a.status === "fulfilled") setNodes(a.value);
    if (m.status === "fulfilled") setMissions(m.value);
    if (t.status === "fulfilled") setTasks(t.value);
    if (r.status === "fulfilled") setResults(r.value);
    if (l.status === "fulfilled") setLedger(l.value);
    if (h.status === "fulfilled") setHealth(h.value);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Operator WebSocket for live updates, with auto-reconnect.
  useEffect(() => {
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(OPERATOR_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        if (!stopped) reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case "node_update": {
            const node = msg.data as Node;
            setNodes((prev) => upsert(prev, node));
            if (node.iot_devices?.length) {
              setIotTelemetry({
                node_id: node.id,
                snapshot: (node.iot_snapshot as Record<string, unknown>) ?? {},
                devices: node.iot_devices,
              });
            }
            break;
          }
          case "iot_telemetry":
            setIotTelemetry(msg.data as IoTTelemetry);
            break;
          case "mission_update":
            setMissions((prev) => upsert(prev, msg.data as Mission));
            break;
          case "task_update":
            setTasks((prev) => upsert(prev, msg.data as Task));
            break;
          case "result":
            setResults((prev) => upsert(prev, msg.data as Result));
            break;
          case "ledger_event":
            setLedger((prev) => upsert(prev, msg.data as LedgerEvent));
            break;
          default:
            break;
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const value = useMemo<C2State>(
    () => ({
      nodes,
      missions,
      tasks,
      results,
      ledger,
      health,
      wsConnected,
      iotTelemetry,
      refreshAll,
    }),
    [nodes, missions, tasks, results, ledger, health, wsConnected, iotTelemetry, refreshAll]
  );

  return <C2Context.Provider value={value}>{children}</C2Context.Provider>;
}

export function useC2(): C2State {
  const ctx = useContext(C2Context);
  if (!ctx) throw new Error("useC2 must be used within C2Provider");
  return ctx;
}
