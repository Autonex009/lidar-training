export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight text-ink ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect width="24" height="24" rx="7" fill="var(--accent)" />
        <path d="M12 5.5 18 9v6l-6 3.5L6 15V9l6-3.5Zm0 0v13M6 9l6 3.5L18 9" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      LiDAR Academy
    </span>
  );
}

export function Icon({ name, size = 18 }: { name: "cube" | "target" | "check" | "book" | "shield" | "arrow"; size?: number }) {
  const paths: Record<string, string> = {
    cube: "M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9",
    target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    check: "m5 12.5 4.5 4.5L19 7.5",
    book: "M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z",
    shield: "M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Zm-3 9 2.5 2.5L15.5 10",
    arrow: "M5 12h14m-6-6 6 6-6 6",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}
