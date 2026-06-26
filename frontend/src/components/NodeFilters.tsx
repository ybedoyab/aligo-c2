import { useMemo, useState } from "react";
import type { Node } from "../types";

interface Props {
  nodes: Node[];
  onChange: (filters: {
    status: string;
    os: string;
    group: string;
    tag: string;
    minHealth: string;
  }) => void;
}

export function NodeFilters({ nodes, onChange }: Props) {
  const [status, setStatus] = useState("");
  const [os, setOs] = useState("");
  const [group, setGroup] = useState("");
  const [tag, setTag] = useState("");
  const [minHealth, setMinHealth] = useState("");

  const groups = useMemo(
    () => [...new Set(nodes.map((n) => n.group).filter(Boolean))].sort(),
    [nodes]
  );
  const tags = useMemo(
    () => [...new Set(nodes.flatMap((n) => n.tags || []))].sort(),
    [nodes]
  );

  const apply = () => onChange({ status, os, group, tag, minHealth });

  return (
    <div className="card p-4 flex flex-wrap gap-3 items-end">
      <FilterSelect label="Status" value={status} onChange={setStatus} options={["", "online", "offline", "warning"]} />
      <FilterInput label="OS contains" value={os} onChange={setOs} />
      <FilterSelect label="Group" value={group} onChange={setGroup} options={["", ...groups]} />
      <FilterSelect label="Tag" value={tag} onChange={setTag} options={["", ...tags]} />
      <FilterInput label="Min health" value={minHealth} onChange={setMinHealth} type="number" />
      <button className="btn-primary text-xs" onClick={apply}>
        Apply filters
      </button>
      <button
        className="btn-ghost text-xs"
        onClick={() => {
          setStatus("");
          setOs("");
          setGroup("");
          setTag("");
          setMinHealth("");
          onChange({ status: "", os: "", group: "", tag: "", minHealth: "" });
        }}
      >
        Clear
      </button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-soc-muted">
      {label}
      <select className="input text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o || "all"} value={o}>
            {o || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-soc-muted">
      {label}
      <input
        className="input text-xs w-28"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
