import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { CardTitle } from "./CardTitle";
import {
  CloseIcon,
  ConsoleIcon,
  DeviceIcon,
  MissionsIcon,
  NodesIcon,
  PlayIcon,
  PlusIcon,
  SaveIcon,
} from "./icons";
import { Select } from "./Select";
import { ALLOWED_PLUGINS, type MissionStep, type Node, type PluginName } from "../types";

const EMPTY_ARGUMENTS = "{}";
const DEFAULT_PLUGIN: PluginName = "health_check";
const ADDED_STEP_PLUGIN: PluginName = "system_info";
const STEP_ANIMATION_DELAY_MS = 45;

const DEFAULT_ARGS: Partial<Record<PluginName, string>> = {
  system_info: EMPTY_ARGUMENTS,
  health_check: EMPTY_ARGUMENTS,
  echo: '{"text": "ping"}',
  list_lab_directory: '{"path": "."}',
  network_info: EMPTY_ARGUMENTS,
  allowed_command: '{"command": "whoami"}',
  gateway_health: EMPTY_ARGUMENTS,
  list_devices: EMPTY_ARGUMENTS,
  get_gateway_snapshot: EMPTY_ARGUMENTS,
  read_temperature: '{"device_id": "temp-001"}',
  read_humidity: '{"device_id": "humidity-001"}',
  read_motion: '{"device_id": "motion-001"}',
  read_light: '{"device_id": "light-001"}',
  led_on: '{"device_id": "led-001"}',
  led_off: '{"device_id": "led-001"}',
  led_blink: '{"device_id": "led-001", "duration_ms": 2000, "interval_ms": 250}',
  led_set_brightness: '{"device_id": "led-001", "brightness": 50}',
};

interface MissionBuilderProps {
  nodes: Node[];
  onChanged: () => void;
  embedded?: boolean;
}

interface DraftStep {
  id: string;
  plugin: PluginName;
  argsText: string;
}

function createDraftStep(plugin: PluginName): DraftStep {
  return {
    id: crypto.randomUUID(),
    plugin,
    argsText: DEFAULT_ARGS[plugin] ?? EMPTY_ARGUMENTS,
  };
}

export function MissionBuilder({ nodes, onChanged, embedded = false }: MissionBuilderProps) {
  const { t, translateError } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>(() => [createDraftStep(DEFAULT_PLUGIN)]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName((current) => (current === "" ? t("missions.customMission") : current));
  }, [t]);

  const toggleNode = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((nodeId) => nodeId !== id) : [...current, id]
    );
  };

  const addStep = () => setSteps((current) => [...current, createDraftStep(ADDED_STEP_PLUGIN)]);

  const updateStep = (id: string, patch: Partial<DraftStep>) => {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, ...patch } : step))
    );
  };

  const removeStep = (id: string) => {
    setSteps((current) => current.filter((step) => step.id !== id));
  };

  const buildSteps = (): MissionStep[] =>
    steps.map((step) => ({
      plugin: step.plugin,
      args: step.argsText.trim() ? JSON.parse(step.argsText) : {},
    }));

  const submit = async (run: boolean) => {
    setBusy(true);
    setError("");
    try {
      if (run && selected.length === 0) throw new Error(t("errors.selectNodeToRun"));
      const mission = await api.createMission({
        name,
        description,
        steps: buildSteps(),
        target_node_ids: selected,
      });
      if (run) await api.startMission(mission.id, selected);
      onChanged();
    } catch (caughtError) {
      setError(translateError((caughtError as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? "flex flex-col gap-5" : "card flex flex-col gap-5 p-5"}>
      {!embedded ? <CardTitle title={t("missions.buildMission")} Icon={MissionsIcon} /> : null}

      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white">
          <MissionsIcon className="h-4 w-4 text-soc-brand" />
          {t("missions.missionDetails")}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-soc-muted">
            {t("missions.name")}
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-soc-muted">
            {t("nodeDetail.description")}
            <input
              className="input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-medium text-white">
            <ConsoleIcon className="h-4 w-4 text-soc-accent" />
            {t("missions.stepsPlugins")}
          </span>
          <button type="button" className="btn-ghost py-1 text-xs" onClick={addStep}>
            <PlusIcon className="h-3.5 w-3.5" />
            {t("missions.addStep")}
          </button>
        </div>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex animate-slide-in-left flex-col gap-2 rounded-lg border border-soc-borderSubtle bg-soc-bg/30 p-2.5 sm:flex-row sm:items-center"
              style={{ animationDelay: `${index * STEP_ANIMATION_DELAY_MS}ms`, animationFillMode: "both" }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-soc-accent/30 bg-soc-accent/10 font-mono text-xs text-soc-accent">
                {index + 1}
              </span>
              <Select
                className="w-full sm:max-w-[180px]"
                buttonClassName="text-xs"
                value={step.plugin}
                ariaLabel={t("missions.stepPlugin", { number: index + 1 })}
                options={ALLOWED_PLUGINS.map((plugin) => ({ value: plugin, label: plugin }))}
                onChange={(value) => {
                  const plugin = value as PluginName;
                  updateStep(step.id, {
                    plugin,
                    argsText: DEFAULT_ARGS[plugin] ?? EMPTY_ARGUMENTS,
                  });
                }}
              />
              <input
                className="input flex-1 font-mono text-xs"
                value={step.argsText}
                onChange={(event) => updateStep(step.id, { argsText: event.target.value })}
                placeholder={t("missions.argsPlaceholder")}
              />
              <button
                type="button"
                className="icon-btn self-end sm:self-auto"
                onClick={() => removeStep(step.id)}
                disabled={steps.length === 1}
                aria-label={t("missions.removeStep", { number: index + 1 })}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white">
          <NodesIcon className="h-4 w-4 text-soc-ok" />
          {t("missions.targetNodes")}
        </div>
        <div className="flex flex-wrap gap-2">
          {nodes.length === 0 ? (
            <span className="text-xs text-soc-muted">{t("missions.noNodesConnected")}</span>
          ) : null}
          {nodes.map((node) => {
            const isSelected = selected.includes(node.id);
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => toggleNode(node.id)}
                aria-pressed={isSelected}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs transition-all hover:-translate-y-0.5 ${getNodeButtonClass(isSelected)}`}
              >
                <DeviceIcon className="h-3.5 w-3.5" />
                {node.id}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <div className="text-xs text-soc-err">{error}</div> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void submit(false)}>
          <SaveIcon className="h-4 w-4" />
          {t("missions.saveDraft")}
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit(true)}>
          <PlayIcon className={`h-4 w-4 ${busy ? "animate-pulse-soft" : ""}`} />
          {busy ? t("common.working") : t("missions.createAndRun")}
        </button>
      </div>
    </div>
  );
}

function getNodeButtonClass(selected: boolean) {
  return selected
    ? "border-soc-brand bg-soc-brand/15 text-soc-brand"
    : "border-soc-border text-soc-muted hover:border-soc-brand";
}
