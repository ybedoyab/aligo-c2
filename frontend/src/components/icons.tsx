import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  );
}

export function NodesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="8.5" y="13" width="7" height="7" rx="1" />
      <path d="M6.5 11V13M17.5 11V13M10 13h4" />
    </Icon>
  );
}

export function TopologyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8 7.5l3.5 8M16 7.5l-3.5 8" />
    </Icon>
  );
}

export function IoTLabIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h2v2H9zM13 9h2v2h-2zM9 13h2v2H9zM13 13h2v2h-2z" fill="currentColor" stroke="none" />
      <path d="M12 4v3M8 20h8" />
    </Icon>
  );
}

export function MissionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h10M4 18h14" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="19" cy="18" r="2" />
    </Icon>
  );
}

export function ConsoleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16v12H4z" />
      <path d="M7 10h6M7 14h4" />
      <path d="M16 14l2 1.5L16 17" />
    </Icon>
  );
}

export function LedgerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
      <path d="M6 4v16" strokeWidth="2.5" />
    </Icon>
  );
}

export function OperatorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
      <path d="m8 10 2 2 5-5" />
    </Icon>
  );
}

export function ServerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="7" rx="2" />
      <rect x="4" y="14" width="16" height="7" rx="2" />
      <path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5" />
    </Icon>
  );
}

export function BlockchainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 7 4-7 4-7-4 7-4Z" />
      <path d="m5 12 7 4 7-4M5 17l7 4 7-4" />
    </Icon>
  );
}
export function CompletedTasksIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </Icon>
  );
}

export function FailedTasksIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 7 8 5-8 5V7Z" fill="currentColor" stroke="none" />
    </Icon>
  );
}
export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.5-2L20 9M4 15l2.4 2a7 7 0 0 0 11.5-2" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function GroupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 16a4 4 0 0 1 6.5 3" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </Icon>
  );
}

export function DeviceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Icon>
  );
}
export function HeartPulseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-7.5a5.5 5.5 0 0 0 0-7.8Z" />
      <path d="M3.5 12h4l1.5-3 3 6 1.5-3h7" />
    </Icon>
  );
}

export function GaugeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.6 19a9 9 0 1 1 12.8 0" />
      <path d="m12 13 4-4M8 17h8" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </Icon>
  );
}
export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m7 10 5 5 5-5" />
    </Icon>
  );
}
export type NavIcon = typeof DashboardIcon;
