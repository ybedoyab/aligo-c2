export function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function shortHash(hash: string | null | undefined, size = 10): string {
  if (!hash) return "-";
  const clean = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (clean.length <= size * 2) return clean;
  return `${clean.slice(0, size)}…${clean.slice(-size)}`;
}

export function formatTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString();
}
