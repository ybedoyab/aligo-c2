export function FlagEs({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </svg>
  );
}

export function FlagEn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="2.5" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.2" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="4" />
      <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="2.2" />
    </svg>
  );
}
