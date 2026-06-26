export function shortHash(hash: string | null | undefined, size = 10): string {
  if (!hash) return "-";
  const clean = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (clean.length <= size * 2) return clean;
  return `${clean.slice(0, size)}…${clean.slice(-size)}`;
}
