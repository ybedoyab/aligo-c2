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

export type NavIcon = typeof DashboardIcon;
