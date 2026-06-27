import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { CardTitle } from "../components/CardTitle";
import {
  CameraIcon,
  ConsoleIcon,
  DeviceIcon,
  DropletIcon,
  GaugeIcon,
  HeartPulseIcon,
  IoTLabIcon,
  MotionIcon,
  PowerIcon,
  RefreshIcon,
  ServerIcon,
  SunIcon,
  ThermometerIcon,
  type NavIcon,
} from "../components/icons";
import { IoTCircuit } from "../components/IoTCircuit";
import {
  IOT_DEVICE_ID,
  IOT_GATEWAY_ID,
  IOT_LOG_LIMIT,
  IOT_POLICY_ID,
  IOT_REFRESH_INTERVAL_MS,
} from "../constants/iot";
import { useI18n } from "../i18n";
import type { IoTLabState } from "../types";

const TAB = {
  CIRCUIT: "circuit",
  JSON: "json",
} as const;
const QUICK_ACTION_ID = {
  LED_ON: "led-on",
  LED_OFF: "led-off",
  LED_BLINK: "led-blink",
  REFRESH_SENSORS: "refresh-sensors",
  HEALTH_CHECK: "health-check",
  SNAPSHOT: "snapshot",
} as const;
const ROW_BADGE_CLASS = {
  ok: "text-soc-ok",
  err: "text-soc-err",
} as const;
const LED_BLINK_DURATION_MS = 2000;
const LED_BLINK_INTERVAL_MS = 250;
const DEVICE_ICON_BY_ID: Record<string, NavIcon> = {
  [IOT_DEVICE_ID.LED]: PowerIcon,
  [IOT_DEVICE_ID.TEMPERATURE]: ThermometerIcon,
  [IOT_DEVICE_ID.HUMIDITY]: DropletIcon,
  [IOT_DEVICE_ID.MOTION]: MotionIcon,
  [IOT_DEVICE_ID.LIGHT]: SunIcon,
};

type Tab = (typeof TAB)[keyof typeof TAB];
type QuickActionId = (typeof QUICK_ACTION_ID)[keyof typeof QUICK_ACTION_ID];

interface IoTCommand {
  plugin: string;
  args?: Record<string, unknown>;
}

interface QuickActionDefinition {
  id: QuickActionId;
  labelKey: string;
  descriptionKey: string;
  Icon: NavIcon;
  iconClass: string;
  commands: IoTCommand[];
}

interface LogEntry {
  id: string;
  text: string;
}

interface IoTLabViewProps {
  ledState: { on?: boolean; brightness?: number; blinking?: boolean };
}

const QUICK_ACTIONS: QuickActionDefinition[] = [
  {
    id: QUICK_ACTION_ID.LED_ON,
    labelKey: "iot.turnLedOn",
    descriptionKey: "iot.turnLedOnDescription",
    Icon: PowerIcon,
    iconClass: "border-soc-ok/30 bg-soc-ok/10 text-soc-ok",
    commands: [{ plugin: "led_on", args: { device_id: IOT_DEVICE_ID.LED } }],
  },
  {
    id: QUICK_ACTION_ID.LED_OFF,
    labelKey: "iot.turnLedOff",
    descriptionKey: "iot.turnLedOffDescription",
    Icon: PowerIcon,
    iconClass: "border-soc-err/30 bg-soc-err/10 text-soc-err",
    commands: [{ plugin: "led_off", args: { device_id: IOT_DEVICE_ID.LED } }],
  },
  {
    id: QUICK_ACTION_ID.LED_BLINK,
    labelKey: "iot.blinkLed",
    descriptionKey: "iot.blinkLedDescription",
    Icon: SunIcon,
    iconClass: "border-soc-warn/30 bg-soc-warn/10 text-soc-warn",
    commands: [
      {
        plugin: "led_blink",
        args: {
          device_id: IOT_DEVICE_ID.LED,
          duration_ms: LED_BLINK_DURATION_MS,
          interval_ms: LED_BLINK_INTERVAL_MS,
        },
      },
    ],
  },
  {
    id: QUICK_ACTION_ID.REFRESH_SENSORS,
    labelKey: "iot.refreshSensors",
    descriptionKey: "iot.refreshSensorsDescription",
    Icon: RefreshIcon,
    iconClass: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    commands: [
      { plugin: "read_temperature", args: { device_id: IOT_DEVICE_ID.TEMPERATURE } },
      { plugin: "read_humidity", args: { device_id: IOT_DEVICE_ID.HUMIDITY } },
    ],
  },
  {
    id: QUICK_ACTION_ID.HEALTH_CHECK,
    labelKey: "iot.runHealthCheck",
    descriptionKey: "iot.runHealthCheckDescription",
    Icon: HeartPulseIcon,
    iconClass: "border-soc-brand/30 bg-soc-brand/10 text-soc-brand",
    commands: [{ plugin: "gateway_health" }],
  },
  {
    id: QUICK_ACTION_ID.SNAPSHOT,
    labelKey: "iot.captureSnapshot",
    descriptionKey: "iot.captureSnapshotDescription",
    Icon: CameraIcon,
    iconClass: "border-soc-accent2/30 bg-soc-accent2/10 text-soc-accent2",
    commands: [{ plugin: "get_gateway_snapshot" }],
  },
];

export function IoTLabView({ ledState }: IoTLabViewProps) {
  const { t, status, formatTime, translateError } = useI18n();
  const [lab, setLab] = useState<IoTLabState | null>(null);
  const [tab, setTab] = useState<Tab>(TAB.CIRCUIT);
  const [activeAction, setActiveAction] = useState<QuickActionId | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      setLab(await api.getIoTLab());
    } catch {
      setLab(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), IOT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const append = useCallback(
    (line: string) => {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        text: `${formatTime(new Date().toISOString())}  ${line}`,
      };
      setLog((current) => [entry, ...current].slice(0, IOT_LOG_LIMIT));
    },
    [formatTime]
  );

  const runQuickAction = async (action: QuickActionDefinition) => {
    setActiveAction(action.id);
    try {
      for (const command of action.commands) {
        const task = await api.runIoTAction({ plugin: command.plugin, args: command.args ?? {} });
        append(t("iot.logSuccess", { plugin: command.plugin, taskId: task.id }));
      }
      await refresh();
    } catch (error) {
      append(t("iot.logError", { message: translateError((error as Error).message) }));
    } finally {
      setActiveAction(null);
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
      <header>
        <h1 className="text-xl font-semibold text-white">{t("iot.title")}</h1>
        <p className="text-sm text-soc-muted">{t("iot.description")}</p>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <section className="card h-full space-y-4 p-5">
          <CardTitle title={t("iot.gatewaySummary")} Icon={ServerIcon} />
          <div className="space-y-2 text-xs">
            <Row label={t("iot.gateway")} value={lab?.gateway_id ?? IOT_GATEWAY_ID} mono />
            <Row
              label={t("nodes.status")}
              value={lab?.online ? status("online") : status("offline")}
              badge={lab?.online ? "ok" : "err"}
            />
            <Row label={t("iot.subdevices")} value={String(lab?.subdevice_count ?? 0)} />
            <Row label={t("iot.health")} value={`${lab?.health_score ?? 0}%`} />
            <Row label={t("nodes.policy")} value={lab?.policy_id ?? IOT_POLICY_ID} />
            <Row
              label={t("iot.lastHeartbeat")}
              value={lab?.last_seen?.slice(11, 19) ?? t("common.dash")}
            />
          </div>
          <span className="inline-block rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
            {t("nodeType.simulated")}
          </span>
        </section>

        <section className="card h-full p-5">
          <CardTitle title={t("iot.telemetry")} Icon={GaugeIcon} className="mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <TelemetryCard
              label={t("iot.temperature")}
              value={`${telemetry?.temperature_c ?? t("common.dash")} °C`}
              Icon={ThermometerIcon}
              iconClass="text-soc-err"
            />
            <TelemetryCard
              label={t("iot.humidity")}
              value={`${telemetry?.humidity_pct ?? t("common.dash")} %`}
              Icon={DropletIcon}
              iconClass="text-cyan-300"
            />
            <TelemetryCard
              label={t("iot.motion")}
              value={telemetry?.motion_detected ? t("iot.detected") : t("iot.clear")}
              Icon={MotionIcon}
              iconClass="text-soc-accent2"
            />
            <TelemetryCard
              label={t("iot.light")}
              value={`${telemetry?.lux ?? t("common.dash")} lux`}
              Icon={SunIcon}
              iconClass="text-soc-warn"
            />
          </div>
        </section>

        <section className="card h-full p-5">
          <CardTitle title={t("iot.circuitPanel")} Icon={DeviceIcon} className="mb-4" />
          <div className="mb-4 flex gap-2" role="tablist" aria-label={t("iot.circuitPanel")}>
            <TabButton
              active={tab === TAB.CIRCUIT}
              label={t("iot.circuitView")}
              onClick={() => setTab(TAB.CIRCUIT)}
            />
            <TabButton
              active={tab === TAB.JSON}
              label={t("iot.deviceStateJson")}
              onClick={() => setTab(TAB.JSON)}
            />
          </div>
          {tab === TAB.CIRCUIT ? (
            <IoTCircuit led={led} />
          ) : (
            <pre className="surface-inset max-h-80 overflow-auto rounded-lg p-4 font-mono text-xs">
              {JSON.stringify(lab?.snapshot ?? devices, null, 2)}
            </pre>
          )}
        </section>

        <section className="card h-full p-5">
          <CardTitle
            title={t("iot.quickActions")}
            description={t("iot.quickActionsDescription")}
            Icon={PowerIcon}
            className="mb-4"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionButton
                key={action.id}
                action={action}
                active={activeAction === action.id}
                disabled={activeAction !== null}
                onClick={() => void runQuickAction(action)}
              />
            ))}
          </div>
        </section>
      </div>

      <section>
        <CardTitle title={t("iot.connectedDevices")} Icon={IoTLabIcon} className="mb-3" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <DeviceCard key={device.device_id} device={device} />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <CardTitle title={t("iot.liveEventStream")} Icon={ConsoleIcon} className="mb-4" />
        <div className="max-h-48 space-y-2 overflow-y-auto font-mono text-xs">
          {log.map((entry) => (
            <div key={entry.id} className="text-soc-muted">
              {entry.text}
            </div>
          ))}
          {(lab?.recent_events ?? []).map((event) => (
            <div key={event.task_id} className="text-soc-muted">
              {event.completed_at?.slice(11, 19) ?? t("common.dash")} · {event.plugin}{" "}
              {event.device_id ? `· ${event.device_id}` : ""} · {status(event.status)}
            </div>
          ))}
          {log.length === 0 && !lab?.recent_events?.length ? (
            <div className="text-soc-muted">{t("iot.runActionHint")}</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
  badge?: keyof typeof ROW_BADGE_CLASS;
}

function Row({ label, value, mono = false, badge }: RowProps) {
  const valueClass = badge ? ROW_BADGE_CLASS[badge] : "text-white";
  return (
    <div className="flex justify-between gap-2">
      <span className="text-soc-muted">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${valueClass}`}>{value}</span>
    </div>
  );
}

interface TelemetryCardProps {
  label: string;
  value: string;
  Icon: NavIcon;
  iconClass: string;
}

function TelemetryCard({ label, value, Icon, iconClass }: TelemetryCardProps) {
  return (
    <div className="rounded-lg border border-soc-borderSubtle bg-soc-panel2/80 p-3 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase text-soc-muted">{label}</div>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function QuickActionButton({
  action,
  active,
  disabled,
  onClick,
}: {
  action: QuickActionDefinition;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const { Icon } = action;

  return (
    <button
      type="button"
      className="group flex min-h-20 w-full items-start gap-3 rounded-xl border border-soc-borderSubtle bg-soc-bg/40 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-soc-brand/40 hover:bg-soc-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${action.iconClass}`}>
        <Icon className={`h-4 w-4 ${active ? "animate-pulse-soft" : ""}`} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-white">
          {active ? t("common.working") : t(action.labelKey)}
        </div>
        <div className="mt-1 text-[11px] leading-relaxed text-soc-muted">
          {t(action.descriptionKey)}
        </div>
      </div>
    </button>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-soc-brand bg-soc-brand/10 text-soc-brand"
          : "border-soc-border text-soc-muted hover:text-white"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function DeviceCard({ device }: { device: IoTLabState["devices"][number] }) {
  const { t } = useI18n();
  const Icon = DEVICE_ICON_BY_ID[device.device_id] ?? DeviceIcon;

  return (
    <article className="card p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-soc-accent/30 bg-soc-accent/10 text-soc-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{device.label}</div>
          <div className="truncate font-mono text-xs text-soc-muted">{device.device_id}</div>
        </div>
        <span className="rounded border border-soc-border px-2 py-0.5 text-[10px] uppercase text-soc-muted">
          {device.device_type}
        </span>
      </div>
      <pre className="mt-3 overflow-x-auto font-mono text-[11px] text-soc-accent">
        {JSON.stringify(device.state)}
      </pre>
      <div className="mt-2 text-[10px] text-soc-muted">
        {device.last_updated?.slice(11, 19) ?? t("common.dash")} · {t("nodeType.simulated")}
      </div>
    </article>
  );
}
