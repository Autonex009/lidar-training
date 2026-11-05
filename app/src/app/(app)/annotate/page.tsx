import Link from "next/link";
import { requireSection } from "@/lib/guard";
import { getUserEnrollment } from "@/lib/enroll";
import { ensureAssignments } from "@/lib/tasks/assignments";
import { listTaskRows, type TaskRow } from "@/lib/tasks/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: "Inspection", IDENTIFICATION: "Identification", CUBOID: "Cuboid", SEMANTIC_SEG: "Semantic segmentation",
  INSTANCE_SEG: "Instance segmentation", TRACKING: "Tracking", ERROR_DETECTION: "Error detection", MIXED: "Mixed",
};
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function Lock() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

function Rows({ rows }: { rows: TaskRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.assignmentId} className={r.locked ? "text-muted" : ""} data-testid={`task-row-${r.code}`}>
          <td className="border-b border-line px-2 py-2 font-medium">{r.code}</td>
          <td className="border-b border-line px-2 py-2">{r.title}</td>
          <td className="border-b border-line px-2 py-2">{cap(r.difficulty)}</td>
          <td className="border-b border-line px-2 py-2">{TYPE_LABEL[r.annotationType] ?? r.annotationType}</td>
          <td className="border-b border-line px-2 py-2 tabular-nums">{r.estimatedMinutes} min</td>
          <td className="border-b border-line px-2 py-2">
            {r.locked ? (
              <span className="inline-flex items-center gap-1 text-[12px]" title={r.lockReason}><Lock />Locked</span>
            ) : <StatusBadge status={r.status as Status} />}
          </td>
          <td className="max-w-[260px] border-b border-line px-2 py-2 text-[12px] text-muted">
            {r.feedbackSnippet ?? (r.locked ? r.lockReason : "")}
          </td>
          <td className="border-b border-line px-2 py-2 text-right">
            {r.locked ? <span className="text-[12px]" title={r.lockReason}>Locked</span> : (
              <Link href={`/annotate/${r.assignmentId}`} className="inline-flex h-7 items-center rounded-full border border-accent bg-accent text-white px-3 text-[12px] font-medium hover:bg-accent-hover">
                {r.status === "NOT_STARTED" ? "Start" : r.status === "PENDING_REVIEW" || r.status === "APPROVED" ? "View" : "Open"}
              </Link>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

export default async function AnnotatePage() {
  const user = await requireSection("annotate");
  const enrollment = await getUserEnrollment(user.id);
  const rows = enrollment ? (await ensureAssignments(user.id, enrollment.programId), await listTaskRows(user.id, enrollment.programId, user.role)) : [];
  const core = rows.filter((r) => !r.trackKey);
  const optional = rows.filter((r) => r.trackKey);
  const head = (
    <thead className="bg-panel text-left text-[12px] text-muted">
      <tr>
        {["Task", "Title", "Difficulty", "Type", "Est. time", "Status", "Previous feedback", ""].map((h) => (
          <th key={h} className="border-b border-line px-2 py-1.5 font-medium">{h}</th>
        ))}
      </tr>
    </thead>
  );
  return (
    <>
      <PageHeader title="Annotate" subtitle={enrollment ? enrollment.program.name : "Annotation tasks"} />
      {rows.length === 0 ? (
        <EmptyState title="No tasks assigned yet" description="Tasks appear here once your program has published tasks." />
      ) : (
        <>
          <table className="w-full border border-line text-[13px]">
            {head}
            <tbody><Rows rows={core} /></tbody>
          </table>
          {optional.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-[13px] font-semibold">Optional tracks</h2>
              <table className="w-full border border-line text-[13px]">
                {head}
                <tbody><Rows rows={optional} /></tbody>
              </table>
            </>
          )}
        </>
      )}
    </>
  );
}
