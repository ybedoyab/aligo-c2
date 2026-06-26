import { useMemo, useState } from "react";
import type { Node } from "../types";
import { useI18n } from "../i18n";

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
  const { t, status } = useI18n();
  const [filterStatus, setFilterStatus] = useState("");
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

  const apply = () => onChange({ status: filterStatus, os, group, tag, minHealth });

  const statusOptions = ["", "online", "offline", "warning"];

  return (
    <div className="card p-4 flex flex-wrap gap-3 items-end">
      <FilterSelect
        className="flex-1 min-w-[9rem]"
        label={t("nodes.status")}
        value={filterStatus}
        onChange={setFilterStatus}
        options={statusOptions.map((o) => ({ value: o, label: o ? status(o) : t("common.all") }))}
      />
      <FilterInput label={t("nodes.osContains")} value={os} onChange={setOs} className="flex-1 min-w-[9rem]" />
      <FilterSelect
        className="flex-1 min-w-[9rem]"
        label={t("nodes.group")}
        value={group}
        onChange={setGroup}
        options={["", ...groups].map((o) => ({ value: o, label: o || t("common.all") }))}
      />
      <FilterSelect
        className="flex-1 min-w-[9rem]"
        label={t("nodes.tag")}
        value={tag}
        onChange={setTag}
        options={["", ...tags].map((o) => ({ value: o, label: o || t("common.all") }))}
      />
      <FilterInput
        label={t("nodes.minHealth")}
        value={minHealth}
        onChange={setMinHealth}
        type="number"
        className="flex-1 min-w-[9rem]"
      />
      <button className="btn-primary text-xs" onClick={apply}>
        {t("common.applyFilters")}
      </button>
      <button
        className="btn-ghost text-xs"
        onClick={() => {
          setFilterStatus("");
          setOs("");
          setGroup("");
          setTag("");
          setMinHealth("");
          onChange({ status: "", os: "", group: "", tag: "", minHealth: "" });
        }}
      >
        {t("common.clear")}
      </button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-soc-muted ${className}`}>
      {label}
      <select className="input text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
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
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-soc-muted ${className}`}>
      {label}
      <input
        className="input text-xs w-full"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
