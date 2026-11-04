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
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200" },
  LOCKED: { label: "Locked", className: "bg-panel text-muted border-line" },
  SUBMITTED: { label: "Submitted", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  PENDING_REVIEW: { label: "Pending Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  REVISION_REQUIRED: { label: "Revision Required", className: "bg-red-50 text-red-700 border-red-200" },
  APPROVED: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
};

export function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${m.className}`}>
      {m.label}
    </span>
  );
}
