import type { ReactNode } from "react";

/** CSS-only tooltip (also sets native title for a11y fallback). `top` + `inline` suit small inline icons. */
export function Tooltip({ text, children, placement = "right", inline = false }: { text: string; children: ReactNode; placement?: "right" | "top"; inline?: boolean }) {
  const pos = placement === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "left-full top-1/2 ml-2 -translate-y-1/2";
  return (
    <span className={`group relative inline-flex ${inline ? "" : "w-full"}`} title={text}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden w-64 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-normal text-ink shadow-float group-hover:block ${pos}`}
      >
        {text}
      </span>
    </span>
  );
}
