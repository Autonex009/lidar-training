import Link from "next/link";
import { requireSection } from "@/lib/guard";
import { listOwnSubmissions, listQueue, queueFilterOptions, isStaff } from "@/lib/review/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { AssignMeButton } from "@/components/review/AssignMeButton";
import { TraineeSubmissions } from "@/components/review/TraineeSubmissions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: "Inspection", IDENTIFICATION: "Identification", CUBOID: "Cuboid", SEMANTIC_SEG: "Semantic seg.",
  INSTANCE_SEG: "Instance seg.", TRACKING: "Tracking", ERROR_DETECTION: "Error detection", MIXED: "Mixed",
};
const ctl = "h-7 rounded border border-line bg-surface px-1.5 text-[12px]";
const th = "border-b border-line px-2 py-1.5 text-left font-medium";
const td = "border-b border-line px-2 py-2 align-top";

type SP = Record<string, string | string[] | undefined>;
const flat = (sp: SP) => Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

export default async function ReviewPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("review");

  if (!isStaff(user.role)) {
    const rows = await listOwnSubmissions(user.id);
    return (
      <>
        <PageHeader title="Review" subtitle="Your submissions and the feedback you received." />
        {rows.length === 0 ? (
          <EmptyState title="No submissions yet" description="Submissions appear here after you submit a task from Annotate. Reviewers then approve it or send it back with feedback." action={<Link href="/annotate" className="text-[13px] underline">Go to Annotate</Link>} />
        ) : <TraineeSubmissions rows={rows} />}
      </>
    );
  }

  const sp = flat(await searchParams);
  const parsed = await listQueue(user, sp).catch(() => null);
  const [opts] = await Promise.all([queueFilterOptions()]);
  const q = parsed && parsed.ok ? parsed : { rows: [], pending: 0 };
  const status = sp.status ?? "PENDING_REVIEW";
  return (
    <>
      <PageHeader title={`Review (${q.pending} pending)`} subtitle="Submissions from trainees. Open one to compare against the reference and decide." />
      <div className="mb-3 flex items-center gap-3 text-[12px]">
        <Link href="/review/history" className="underline">My decision history</Link>
      </div>
      <form method="get" className="mb-3 flex flex-wrap items-end gap-2 text-[12px]" data-testid="queue-filters">
        <label className="flex flex-col gap-0.5">Status
          <select name="status" defaultValue={status} className={ctl}>
            <option value="PENDING_REVIEW">Pending Review</option><option value="REVISION_REQUIRED">Revision Required</option><option value="APPROVED">Approved</option><option value="ALL">All</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">Task
          <select name="taskId" defaultValue={sp.taskId ?? ""} className={ctl}><option value="">All</option>{opts.tasks.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select>
        </label>
        <label className="flex flex-col gap-0.5">Trainee
          <select name="traineeId" defaultValue={sp.traineeId ?? ""} className={ctl}><option value="">All</option>{opts.trainees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <label className="flex flex-col gap-0.5">Program
          <select name="programId" defaultValue={sp.programId ?? ""} className={ctl}><option value="">All</option>{opts.programs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <label className="flex flex-col gap-0.5">From<input type="date" name="from" defaultValue={sp.from ?? ""} className={ctl} /></label>
        <label className="flex flex-col gap-0.5">To<input type="date" name="to" defaultValue={sp.to ?? ""} className={ctl} /></label>
        <label className="flex h-7 items-center gap-1"><input type="checkbox" name="mine" value="1" defaultChecked={Boolean(sp.mine)} />Assigned to me</label>
        <button type="submit" className="h-7 rounded-full border border-accent bg-accent text-white px-3 font-medium">Apply</button>
        <Link href="/review" className="flex h-7 items-center text-muted underline">Reset</Link>
      </form>
      {q.rows.length === 0 ? (
        <EmptyState title="Nothing matches" description={status === "PENDING_REVIEW" ? "No submissions are waiting for review." : "No submissions match these filters."} />
      ) : (
        <table className="w-full border border-line text-[13px]" data-testid="review-queue">
          <thead className="bg-panel text-[12px] text-muted">
            <tr>{["Trainee", "Task", "Program", "Submitted", "Attempt", "Type", "Status", "Reviewer", "Prior feedback", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {q.rows.map((r) => (
              <tr key={r.submissionId} data-testid={`queue-row-${r.taskCode}`}>
                <td className={td}>{r.traineeName}</td>
                <td className={td}><span className="font-medium">{r.taskCode}</span> {r.taskTitle}</td>
                <td className={td}>{r.programName}</td>
                <td className={`${td} whitespace-nowrap`}>{new Date(r.submittedAt).toLocaleString()}</td>
                <td className={`${td} tabular-nums`}>{r.attempt}</td>
                <td className={td}>{TYPE_LABEL[r.annotationType] ?? r.annotationType}</td>
                <td className={td}><StatusBadge status={r.status as Status} /></td>
                <td className={td}>{r.reviewerName ?? <span className="text-muted">Unassigned</span>}</td>
                <td className={`${td} max-w-[220px] text-[12px] text-muted`}>{r.priorFeedback ?? "-"}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {r.reviewerId !== user.id && r.status === "PENDING_REVIEW" && <AssignMeButton submissionId={r.submissionId} />}{" "}
                  <Link href={`/review/${r.submissionId}`} className="inline-flex h-6 items-center rounded-full border border-accent bg-accent text-white px-2 text-[11px] font-medium hover:bg-accent-hover">{r.status === "PENDING_REVIEW" ? "Review" : "View"}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
