import type { ReactNode } from "react";

/** CSS-only tooltip (also sets native title for a11y fallback). */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex w-full" title={text}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden w-64 -translate-y-1/2 rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}
