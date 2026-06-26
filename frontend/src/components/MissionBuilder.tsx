import { useState } from "react";
import { api } from "../api/client";
import {
  ALLOWED_PLUGINS,
  type Node,
  type MissionStep,
  type PluginName,
} from "../types";

interface Props {
  nodes: Node[];
  onChanged: () => void;
}

const DEFAULT_ARGS: Partial<Record<PluginName, string>> = {
  system_info: "{}",
  health_check: "{}",
  echo: '{"text": "ping"}',
  list_lab_directory: '{"path": "."}',
  network_info: "{}",
  allowed_command: '{"command": "whoami"}',
  gateway_health: "{}",
  list_devices: "{}",
  get_gateway_snapshot: "{}",
  read_temperature: '{"device_id": "temp-001"}',
  read_humidity: '{"device_id": "humidity-001"}',
  read_motion: '{"device_id": "motion-001"}',
  read_light: '{"device_id": "light-001"}',
  led_on: '{"device_id": "led-001"}',
  led_off: '{"device_id": "led-001"}',
  led_blink: '{"device_id": "led-001", "duration_ms": 2000, "interval_ms": 250}',
  led_set_brightness: '{"device_id": "led-001", "brightness": 50}',
};

interface DraftStep {
  plugin: PluginName;
  argsText: string;
}

export function MissionBuilder({ nodes, onChanged }: Props) {
  const [name, setName] = useState("Custom Mission");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([
    { plugin: "health_check", argsText: "{}" },
  ]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleNode = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );

  const addStep = () =>
    setSteps((prev) => [...prev, { plugin: "system_info", argsText: "{}" }]);

  const updateStep = (idx: number, patch: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const removeStep = (idx: number) =>
    setSteps((prev) => prev.filter((_, i) => i !== idx));

  const buildSteps = (): MissionStep[] =>
    steps.map((s) => ({
      plugin: s.plugin,
      args: s.argsText.trim() ? JSON.parse(s.argsText) : {},
    }));

  const submit = async (run: boolean) => {
    setBusy(true);
    setError("");
    try {
      const parsedSteps = buildSteps();
      const mission = await api.createMission({
        name,
        description,
        steps: parsedSteps,
        target_node_ids: selected,
      });
      if (run) {
        if (selected.length === 0) {
          throw new Error("select at least one node to run the mission");
        }
        await api.startMission(mission.id, selected);
      }
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-white">Build a mission</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-soc-muted">
          Description
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-soc-muted">Steps (plugins)</span>
          <button className="btn-ghost py-1 text-xs" onClick={addStep}>
            + Add step
          </button>
        </div>
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              className="input text-xs"
              value={step.plugin}
              onChange={(e) =>
                updateStep(idx, {
                  plugin: e.target.value as PluginName,
                  argsText: DEFAULT_ARGS[e.target.value as PluginName] ?? "{}",
                })
              }
            >
              {ALLOWED_PLUGINS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              className="input flex-1 font-mono text-xs"
              value={step.argsText}
              onChange={(e) => updateStep(idx, { argsText: e.target.value })}
              placeholder='args JSON, e.g. {"text":"hi"}'
            />
            <button
              className="btn-ghost py-1 text-xs"
              onClick={() => removeStep(idx)}
              disabled={steps.length === 1}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-soc-muted">Target nodes</span>
        <div className="flex flex-wrap gap-2">
          {nodes.length === 0 && (
            <span className="text-xs text-soc-muted">No nodes connected.</span>
          )}
          {nodes.map((a) => (
            <button
              key={a.id}
              onClick={() => toggleNode(a.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
                selected.includes(a.id)
                  ? "border-soc-accent bg-soc-accent/15 text-soc-accent"
                  : "border-soc-border text-soc-muted hover:border-soc-accent"
              }`}
            >
              {a.id}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-xs text-soc-err">{error}</div>}

      <div className="flex gap-2">
        <button className="btn-ghost" disabled={busy} onClick={() => submit(false)}>
          Save draft
        </button>
        <button className="btn-primary" disabled={busy} onClick={() => submit(true)}>
          {busy ? "Working…" : "Create & run"}
        </button>
      </div>
    </div>
  );
}
