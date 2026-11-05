export type Status =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "LOCKED"
  | "SUBMITTED"
  | "PENDING_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "COMPLETED";

export const STATUS_META: Record<Status, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-panel text-muted border-line" },
  IN_PROGRESS: { label: "In Progress", className: "bg-accent-tint text-accent border-accent/25" },
  LOCKED: { label: "Locked", className: "bg-panel text-muted border-line" },
  SUBMITTED: { label: "Submitted", className: "bg-accent-tint text-accent border-accent/25" },
  PENDING_REVIEW: { label: "Pending Review", className: "bg-accent-tint text-accent border-accent/25" },
  REVISION_REQUIRED: { label: "Revision Required", className: "bg-warning/10 text-warning-ink border-warning/40" },
  APPROVED: { label: "Approved", className: "bg-success/10 text-success-ink border-success/30" },
  COMPLETED: { label: "Completed", className: "bg-success/10 text-success-ink border-success/30" },
};

export function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.className}`}>
      {m.label}
    </span>
  );
}
