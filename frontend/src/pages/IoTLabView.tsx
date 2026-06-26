import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { IoTCircuit } from "../components/IoTCircuit";
import type { IoTLabState } from "../types";

interface Props {
  ledState: { on?: boolean; brightness?: number; blinking?: boolean };
}

export function IoTLabView({ ledState }: Props) {
  const [lab, setLab] = useState<IoTLabState | null>(null);
  const [tab, setTab] = useState<"circuit" | "json">("circuit");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const refresh = () => api.getIoTLab().then(setLab).catch(() => setLab(null));

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  const append = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 25));

  const runAction = async (plugin: string, args: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const task = await api.runIoTAction({ plugin, args });
      append(`✓ ${plugin} → task ${task.id}`);
      await refresh();
    } catch (e) {
      append(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const telemetry = lab?.telemetry;
  const devices = lab?.devices ?? [];

  const led = useMemo(
    () => ({
      on: ledState.on ?? (telemetry?.led as { on?: boolean } | null)?.on ?? false,
      brightness:
        ledState.brightness ??
        (telemetry?.led as { brightness?: number } | null)?.brightness ??
        0,
      blinking:
        ledState.blinking ??
        (telemetry?.led as { blinking?: boolean } | null)?.blinking ??
        false,
    }),
    [ledState, telemetry?.led]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">IoT Lab</h1>
        <p className="text-sm text-soc-muted">
          Simulated IoT gateway with live sensors, actuators, and blockchain-backed evidence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-white">Gateway summary</h3>
          <div className="text-xs space-y-2">
            <Row label="Gateway" value={lab?.gateway_id ?? "gateway-sim-001"} mono />
            <Row
              label="Status"
              value={lab?.online ? "online" : "offline"}
              badge={lab?.online ? "ok" : "err"}
            />
            <Row label="Subdevices" value={String(lab?.subdevice_count ?? 0)} />
            <Row label="Health" value={`${lab?.health_score ?? 0}%`} />
            <Row label="Policy" value={lab?.policy_id ?? "iot_demo_policy"} />
            <Row label="Last heartbeat" value={lab?.last_seen?.slice(11, 19) ?? "—"} />
          </div>
          <span className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            simulated
          </span>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-3">Telemetry</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TelemetryCard label="Temperature" value={`${telemetry?.temperature_c ?? "—"} °C`} />
            <TelemetryCard label="Humidity" value={`${telemetry?.humidity_pct ?? "—"} %`} />
            <TelemetryCard
              label="Motion"
              value={telemetry?.motion_detected ? "Detected" : "Clear"}
            />
            <TelemetryCard label="Light" value={`${telemetry?.lux ?? "—"} lux`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <div className="flex gap-2 mb-4">
            {(["circuit", "json"] as const).map((t) => (
              <button
                key={t}
                className={`text-xs px-3 py-1 rounded-lg border ${
                  tab === t
                    ? "border-soc-accent text-soc-accent bg-soc-accent/10"
                    : "border-soc-border text-soc-muted"
                }`}
                onClick={() => setTab(t)}
              >
                {t === "circuit" ? "Circuit View" : "Device State JSON"}
              </button>
            ))}
          </div>
          {tab === "circuit" ? (
            <IoTCircuit led={led} />
          ) : (
            <pre className="text-xs font-mono bg-soc-bg border border-soc-border rounded-lg p-4 overflow-auto max-h-80">
              {JSON.stringify(lab?.snapshot ?? devices, null, 2)}
            </pre>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Quick actions</h3>
          <div className="grid grid-cols-1 gap-2">
            <ActionBtn disabled={busy} onClick={() => runAction("led_on", { device_id: "led-001" })}>
              Turn LED on
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => runAction("led_off", { device_id: "led-001" })}>
              Turn LED off
            </ActionBtn>
            <ActionBtn
              disabled={busy}
              onClick={() =>
                runAction("led_blink", {
                  device_id: "led-001",
                  duration_ms: 2000,
                  interval_ms: 250,
                })
              }
            >
              Blink LED
            </ActionBtn>
            <ActionBtn
              disabled={busy}
              onClick={async () => {
                await runAction("read_temperature", { device_id: "temp-001" });
                await runAction("read_humidity", { device_id: "humidity-001" });
              }}
            >
              Refresh sensors
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => runAction("gateway_health")}>
              Run IoT Health Check
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => runAction("get_gateway_snapshot")}>
              Capture Environment Snapshot
            </ActionBtn>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {devices.map((d) => (
          <div key={d.device_id} className="card p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-white font-medium">{d.label}</div>
                <div className="text-xs font-mono text-soc-muted">{d.device_id}</div>
              </div>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded border border-soc-border text-soc-muted">
                {d.device_type}
              </span>
            </div>
            <pre className="text-[11px] font-mono text-soc-accent mt-2 overflow-x-auto">
              {JSON.stringify(d.state)}
            </pre>
            <div className="text-[10px] text-soc-muted mt-2">
              {d.last_updated?.slice(11, 19) ?? "—"} · simulated
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Live event stream</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto text-xs font-mono">
          {log.map((line, i) => (
            <div key={`${line}-${i}`} className="text-soc-muted">
              {line}
            </div>
          ))}
          {(lab?.recent_events ?? []).map((ev) => (
            <div key={ev.task_id} className="text-soc-muted">
              {ev.completed_at?.slice(11, 19) ?? "—"} · {ev.plugin}{" "}
              {ev.device_id ? `· ${ev.device_id}` : ""} · {ev.status}
            </div>
          ))}
          {!log.length && !(lab?.recent_events?.length) && (
            <div className="text-soc-muted">Run a quick action to see IoT events.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: "ok" | "err";
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-soc-muted">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          badge === "ok" ? "text-soc-ok" : badge === "err" ? "text-soc-err" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function TelemetryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-soc-bg border border-soc-border rounded-lg p-3">
      <div className="text-[10px] text-soc-muted uppercase">{label}</div>
      <div className="text-lg text-white font-semibold mt-1">{value}</div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <button className="btn-ghost text-xs text-left w-full" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
