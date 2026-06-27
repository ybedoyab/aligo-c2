import type { NavIcon } from "./icons";

interface CardTitleProps {
  title: string;
  Icon: NavIcon;
  description?: string;
  iconClass?: string;
  className?: string;
}

export function CardTitle({
  title,
  Icon,
  description,
  iconClass = "border-soc-brand/30 bg-soc-brand/10 text-soc-brand",
  className = "",
}: CardTitleProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description ? <p className="text-xs text-soc-muted">{description}</p> : null}
      </div>
    </div>
  );
}
