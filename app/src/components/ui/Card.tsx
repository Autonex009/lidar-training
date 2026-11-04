import type { HTMLAttributes } from "react";

/** Flat bordered container. Use sparingly; prefer tables for lists. */
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-md border border-line bg-surface p-4 ${className}`} {...props} />;
}
