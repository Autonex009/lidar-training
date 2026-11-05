import type { HTMLAttributes } from "react";

/** White rounded card. `float` adds the soft brand shadow (floating cards only). */
export function Card({ className = "", float = false, ...props }: HTMLAttributes<HTMLDivElement> & { float?: boolean }) {
  return <div className={`rounded-xl border border-line bg-surface p-5 ${float ? "shadow-float" : ""} ${className}`} {...props} />;
}
