import type { ReactNode } from "react";
import type { NavIcon } from "./icons";

interface TopologyStageProps {
  label: string;
  description: string;
  Icon: NavIcon;
  accentClass: string;
  iconClass: string;
  children?: ReactNode;
  animationDelayMs?: number;
  className?: string;
}

export function TopologyStage({
  label,
  description,
  Icon,
  accentClass,
  iconClass,
  children,
  animationDelayMs = 0,
  className = "",
}: TopologyStageProps) {
  return (
    <section
      className={`relative animate-slide-up rounded-xl border bg-soc-panel2/60 p-3 ${accentClass} ${className}`}
      style={{ animationDelay: `${animationDelayMs}ms`, animationFillMode: "both" }}
    >
      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-soc-brand shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse-soft" />
      <div className="flex items-center gap-3 pr-5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-soc-bg/70 ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{label}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-soc-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

interface TopologyConnectorProps {
  className?: string;
  colorClass?: string;
}

export function TopologyConnector({
  className = "ml-[35px]",
  colorClass = "from-soc-brand/70 to-soc-accent2/40",
}: TopologyConnectorProps) {
  return <div className={`h-8 w-px bg-gradient-to-b ${colorClass} ${className}`} aria-hidden="true" />;
}
