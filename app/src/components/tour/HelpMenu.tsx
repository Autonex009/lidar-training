"use client";

import { useEffect, useRef, useState } from "react";
import { useTourOptional } from "./TourProvider";

const LABEL: Record<string, string> = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed", SKIPPED: "Skipped" };

/** "?" button with a dropdown of the tutorials relevant to this page and role. */
export function HelpMenu({ compact = false }: { compact?: boolean }) {
  const tour = useTourOptional();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);

  if (!tour) return null;
  const list = tour.helpTours();
  return (
    <div className="relative" ref={ref} data-tour="topbar-help">
      <button
        type="button" aria-label="Help" aria-haspopup="dialog" aria-expanded={open} data-testid="help-button" onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-center rounded-md border border-line text-[13px] font-medium hover:bg-panel ${compact ? "h-7 w-7" : "h-8 w-8"}`}
      >?</button>
      {open ? (
        <div role="menu" aria-label="Tutorials" data-testid="help-menu" className="absolute right-0 top-full z-[90] mt-1 w-80 rounded-md border border-line bg-surface p-1 text-[13px]">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Tutorials</p>
          {list.length === 0 && <p className="px-2 py-2 text-muted">No tutorials for this page.</p>}
          {list.map((d) => {
            const st = tour.statuses[d.key]?.status ?? "NOT_STARTED";
            return (
              <div key={d.key} role="menuitem" data-testid={`help-item-${d.key}`} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-panel">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.title}</span>
                  <span className="block text-[11px] text-muted" data-testid={`help-status-${d.key}`}>{LABEL[st]}</span>
                </span>
                <button
                  type="button" data-testid={`help-start-${d.key}`}
                  onClick={() => { setOpen(false); tour.startTour(d.key, { force: true }); }}
                  className="h-7 rounded border border-line bg-surface px-2.5 text-[12px] font-medium hover:bg-accent-tint"
                >{st === "NOT_STARTED" ? "Start" : "Restart"}</button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
