import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import type { Node } from "../types";
import { FilterIcon, RefreshIcon } from "./icons";
import { Select, type SelectOption } from "./Select";

const EMPTY_FILTER_VALUE = "";
const NODE_STATUS_OPTIONS = [EMPTY_FILTER_VALUE, "online", "offline", "warning"];

export interface NodeFilterValues {
  status: string;
  os: string;
  group: string;
  tag: string;
  minHealth: string;
}

interface NodeFiltersProps {
  nodes: Node[];
  onChange: (filters: NodeFilterValues) => void;
}

const EMPTY_FILTERS: NodeFilterValues = {
  status: EMPTY_FILTER_VALUE,
  os: EMPTY_FILTER_VALUE,
  group: EMPTY_FILTER_VALUE,
  tag: EMPTY_FILTER_VALUE,
  minHealth: EMPTY_FILTER_VALUE,
};

export function NodeFilters({ nodes, onChange }: NodeFiltersProps) {
  const { t, status: translateStatus } = useI18n();
  const [filters, setFilters] = useState<NodeFilterValues>(EMPTY_FILTERS);

  const groups = useMemo(
    () => [...new Set(nodes.map((node) => node.group).filter(Boolean))].sort(),
    [nodes]
  );
  const tags = useMemo(
    () => [...new Set(nodes.flatMap((node) => node.tags))].sort(),
    [nodes]
  );

  const updateFilter = (key: keyof NodeFilterValues, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    onChange(EMPTY_FILTERS);
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-soc-borderSubtle px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-soc-accent/30 bg-soc-accent/10 text-soc-accent">
          <FilterIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{t("nodes.filtersTitle")}</h2>
          <p className="text-xs text-soc-muted">{t("nodes.filtersDescription")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <FilterSelect
          label={t("nodes.status")}
          value={filters.status}
          onChange={(value) => updateFilter("status", value)}
          options={NODE_STATUS_OPTIONS.map((value) => ({
            value,
            label: value ? translateStatus(value) : t("common.all"),
          }))}
        />
        <FilterInput
          label={t("nodes.osContains")}
          value={filters.os}
          onChange={(value) => updateFilter("os", value)}
        />
        <FilterSelect
          label={t("nodes.group")}
          value={filters.group}
          onChange={(value) => updateFilter("group", value)}
          options={[EMPTY_FILTER_VALUE, ...groups].map((value) => ({
            value,
            label: value || t("common.all"),
          }))}
        />
        <FilterSelect
          label={t("nodes.tag")}
          value={filters.tag}
          onChange={(value) => updateFilter("tag", value)}
          options={[EMPTY_FILTER_VALUE, ...tags].map((value) => ({
            value,
            label: value || t("common.all"),
          }))}
        />
        <FilterInput
          label={t("nodes.minHealth")}
          value={filters.minHealth}
          onChange={(value) => updateFilter("minHealth", value)}
          type="number"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-soc-borderSubtle px-4 py-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-ghost text-xs" onClick={clearFilters}>
          <RefreshIcon className="h-4 w-4" />
          {t("common.clear")}
        </button>
        <button type="button" className="btn-primary text-xs" onClick={() => onChange(filters)}>
          <FilterIcon className="h-4 w-4" />
          {t("common.applyFilters")}
        </button>
      </div>
    </section>
  );
}

type FilterOption = SelectOption;

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-soc-muted">
      {label}
      <Select
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={label}
        buttonClassName="text-xs"
      />
    </label>
  );
}

interface FilterInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
}

function FilterInput({ label, value, onChange, type = "text" }: FilterInputProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-soc-muted">
      {label}
      <input
        className="input w-full text-xs"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
