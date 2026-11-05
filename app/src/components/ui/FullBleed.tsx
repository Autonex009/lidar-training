import type { ReactNode } from "react";

/**
 * Marks a page as full-bleed (workspaces, certificate). The (app) layout frames normal pages in a
 * centred 1200px column; `main:has(> [data-full-bleed])` drops that frame, so no client state or flash.
 */
export function FullBleed({ children }: { children: ReactNode }) {
  return <div data-full-bleed>{children}</div>;
}
