import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { IoTCircuit } from "../components/IoTCircuit";
import { useI18n } from "../i18n";
import type { IoTLabState } from "../types";

interface Props {
  ledState: { on?: boolean; brightness?: number; blinking?: boolean };
}

export function IoTLabView({ ledState }: Props) {
  const { t, status, formatTime, translateError } = useI18n();
  const [lab, setLab] = useState<IoTLabState | null>(null);
  const [tab, setTab] = useState<"circuit" | "json">("circuit");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const refresh = () => api.getIoTLab().then(setLab).catch(() => setLab(null));

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);

  const append = (line: string) =>
    setLog((prev) => [`${formatTime(new Date().toISOString())}  ${line}`, ...prev].slice(0, 25));

  const runAction = async (plugin: string, args: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const task = await api.runIoTAction({ plugin, args });
      append(t("iot.logSuccess", { plugin, taskId: task.id }));
      await refresh();
    } catch (e) {
      append(t("iot.logError", { message: translateError((e as Error).message) }));
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
        <h1 className="text-xl font-semibold text-white">{t("iot.title")}</h1>
        <p className="text-sm text-soc-muted">{t("iot.description")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-white">{t("iot.gatewaySummary")}</h3>
          <div className="text-xs space-y-2">
            <Row label={t("iot.gateway")} value={lab?.gateway_id ?? "gateway-sim-001"} mono />
            <Row
              label={t("nodes.status")}
              value={lab?.online ? status("online") : status("offline")}
              badge={lab?.online ? "ok" : "err"}
            />
            <Row label={t("iot.subdevices")} value={String(lab?.subdevice_count ?? 0)} />
            <Row label={t("iot.health")} value={`${lab?.health_score ?? 0}%`} />
            <Row label={t("nodes.policy")} value={lab?.policy_id ?? "iot_demo_policy"} />
            <Row
              label={t("iot.lastHeartbeat")}
              value={lab?.last_seen?.slice(11, 19) ?? t("common.dash")}
            />
          </div>
          <span className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {t("nodeType.simulated")}
          </span>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-3">{t("iot.telemetry")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TelemetryCard
              label={t("iot.temperature")}
              value={`${telemetry?.temperature_c ?? t("common.dash")} °C`}
            />
            <TelemetryCard
              label={t("iot.humidity")}
              value={`${telemetry?.humidity_pct ?? t("common.dash")} %`}
            />
            <TelemetryCard
              label={t("iot.motion")}
              value={telemetry?.motion_detected ? t("iot.detected") : t("iot.clear")}
            />
            <TelemetryCard
              label={t("iot.light")}
              value={`${telemetry?.lux ?? t("common.dash")} lux`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <div className="flex gap-2 mb-4">
            {(["circuit", "json"] as const).map((tabKey) => (
              <button
                key={tabKey}
                className={`text-xs px-3 py-1 rounded-lg border ${
                  tab === tabKey
                    ? "border-soc-brand text-soc-brand bg-soc-brand/10"
                    : "border-soc-border text-soc-muted"
                }`}
                onClick={() => setTab(tabKey)}
              >
                {tabKey === "circuit" ? t("iot.circuitView") : t("iot.deviceStateJson")}
              </button>
            ))}
          </div>
          {tab === "circuit" ? (
            <IoTCircuit led={led} />
          ) : (
            <pre className="text-xs font-mono surface-inset rounded-lg p-4 overflow-auto max-h-80">
              {JSON.stringify(lab?.snapshot ?? devices, null, 2)}
            </pre>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">{t("iot.quickActions")}</h3>
          <div className="grid grid-cols-1 gap-2">
            <ActionBtn disabled={busy} onClick={() => runAction("led_on", { device_id: "led-001" })}>
              {t("iot.turnLedOn")}
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => runAction("led_off", { device_id: "led-001" })}>
              {t("iot.turnLedOff")}
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
              {t("iot.blinkLed")}
            </ActionBtn>
            <ActionBtn
              disabled={busy}
              onClick={async () => {
                await runAction("read_temperature", { device_id: "temp-001" });
                await runAction("read_humidity", { device_id: "humidity-001" });
              }}
            >
              {t("iot.refreshSensors")}
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => runAction("gateway_health")}>
              {t("iot.runHealthCheck")}
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => runAction("get_gateway_snapshot")}>
              {t("iot.captureSnapshot")}
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
              {d.last_updated?.slice(11, 19) ?? t("common.dash")} · {t("nodeType.simulated")}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-white mb-3">{t("iot.liveEventStream")}</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto text-xs font-mono">
          {log.map((line, i) => (
            <div key={`${line}-${i}`} className="text-soc-muted">
              {line}
            </div>
          ))}
          {(lab?.recent_events ?? []).map((ev) => (
            <div key={ev.task_id} className="text-soc-muted">
              {ev.completed_at?.slice(11, 19) ?? t("common.dash")} · {ev.plugin}{" "}
              {ev.device_id ? `· ${ev.device_id}` : ""} · {status(ev.status)}
            </div>
          ))}
          {!log.length && !(lab?.recent_events?.length) && (
            <div className="text-soc-muted">{t("iot.runActionHint")}</div>
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
    <div className="bg-soc-panel2/80 border border-soc-borderSubtle rounded-lg p-3">
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
