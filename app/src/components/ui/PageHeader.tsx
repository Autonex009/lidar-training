import type { ReactNode } from "react";

/** Page title block: 24px title, muted subtitle, optional right-hand action and a chip row underneath. */
export function PageHeader({ title, subtitle, action, chips }: { title: string; subtitle?: string; action?: ReactNode; chips?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-8 tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-[14px] text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {chips ? <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div> : null}
    </header>
  );
}
