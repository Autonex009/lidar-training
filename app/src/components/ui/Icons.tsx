import type { ReactNode } from "react";

/** 24px line icons (1.6 stroke). One place so every page draws them the same way. */
const PATHS = {
  learn: <path d="M3 5.5 12 3l9 2.5v13L12 21l-9-2.5v-13ZM12 3v18" />,
  annotate: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" />,
  review: <path d="M4 5h16v11H9l-5 4V5ZM8 9h8M8 12h5" />,
  complete: <path d="m5 12 4.5 4.5L19 7" />,
  admin: <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />,
  quiz: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 16.5v.01" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.5v.01" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  cube: <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9" />,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.6a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.2.9-1.2 1.7M12 16.6v.01" /></>,
  bell: <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5ZM10 20.5h4" />,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".6" /></>,
  scan: <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 12h8" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  paint: <path d="M12 3.5c4.7 0 8.5 3.1 8.5 7 0 2.5-1.9 3.6-4 3.6h-1.5a1.7 1.7 0 0 0-1.2 2.9c.7.8.2 2-.9 2C7.3 19 3.5 15.6 3.5 11.5S7.3 3.5 12 3.5ZM8 10.5v.01M12 7.5v.01M16 10.5v.01" />,
  route: <path d="M6 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 16.5h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" />,
  flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  inbox: <path d="M3.5 13.5 6 5h12l2.5 8.5v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-5ZM3.5 13.5H8a1 1 0 0 1 1 1 3 3 0 0 0 6 0 1 1 0 0 1 1-1h4.5" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  award: <><circle cx="12" cy="9" r="5.5" /><path d="m8.7 13.6-1.7 7 5-2.6 5 2.6-1.7-7" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function UIcon({ name, size = 16, className = "", label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      {PATHS[name]}
    </svg>
  );
}
