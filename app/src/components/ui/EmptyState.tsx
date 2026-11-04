import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-md border border-dashed border-line bg-panel px-4 py-8">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
