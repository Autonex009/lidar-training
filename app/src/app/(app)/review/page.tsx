import Link from "next/link";
import { requireSection } from "@/lib/guard";
import { listOwnSubmissions, listQueue, queueFilterOptions, isStaff } from "@/lib/review/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { table, tableCard, thead, th, td, input } from "@/components/ui/table";
import { Chip } from "@/components/ui/Chip";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { AssignMeButton } from "@/components/review/AssignMeButton";
import { TraineeSubmissions } from "@/components/review/TraineeSubmissions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: "Inspection", IDENTIFICATION: "Identification", CUBOID: "Cuboid", SEMANTIC_SEG: "Semantic seg.",
  INSTANCE_SEG: "Instance seg.", TRACKING: "Tracking", ERROR_DETECTION: "Error detection", MIXED: "Mixed",
};
const ctl = input;

type SP = Record<string, string | string[] | undefined>;
const STATUSES: [string, string][] = [["PENDING_REVIEW", "Pending"], ["REVISION_REQUIRED", "Revision required"], ["APPROVED", "Approved"], ["ALL", "All"]];
const flat = (sp: SP) => Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

export default async function ReviewPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("review");

  if (!isStaff(user.role)) {
    const rows = await listOwnSubmissions(user.id);
    return (
      <>
        <PageHeader
          title="Review"
          subtitle="Your submissions and the feedback you received."
          chips={rows.length ? <><Chip tone="primary">{rows.filter((r) => r.status === "PENDING_REVIEW").length} waiting for review</Chip><Chip tone="success">{rows.filter((r) => r.status === "APPROVED").length} approved</Chip><Chip tone="warning">{rows.filter((r) => r.status === "REVISION_REQUIRED").length} need revision</Chip></> : null}
        />
        {rows.length === 0 ? (
          <EmptyState variant="inbox" title="No submissions yet" description="Submissions appear here after you submit a task from Annotate. Reviewers then approve it or send it back with feedback." action={<ButtonLink href="/annotate" variant="primary">Go to Annotate</ButtonLink>} />
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
      <PageHeader
        title={`Review (${q.pending} pending)`}
        subtitle="Submissions from trainees. Open one to compare against the reference and decide."
        chips={<Chip tone={q.pending ? "primary" : "plain"}>{q.pending} pending</Chip>}
        action={<Link href="/review/history" className="text-[14px] font-medium text-accent hover:underline">My decision history</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Status filter">
        {STATUSES.map(([v, label]) => (
          <Link key={v} href={`/review?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, x]) => k !== "status" && x)) as Record<string, string>, status: v }).toString()}`} aria-pressed={status === v}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-[14px] font-medium ${status === v ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:bg-panel"}`}>{label}</Link>
        ))}
      </div>
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 text-[12px] text-muted" data-testid="queue-filters">
        <input type="hidden" name="status" value={status} />
        <label className="flex flex-col gap-1">Task
          <select name="taskId" defaultValue={sp.taskId ?? ""} className={ctl}><option value="">All</option>{opts.tasks.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1">Trainee
          <select name="traineeId" defaultValue={sp.traineeId ?? ""} className={ctl}><option value="">All</option>{opts.trainees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1">Program
          <select name="programId" defaultValue={sp.programId ?? ""} className={ctl}><option value="">All</option>{opts.programs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1">From<input type="date" name="from" defaultValue={sp.from ?? ""} className={ctl} /></label>
        <label className="flex flex-col gap-1">To<input type="date" name="to" defaultValue={sp.to ?? ""} className={ctl} /></label>
        <label className="flex h-9 items-center gap-2 text-[14px] text-ink"><input type="checkbox" name="mine" value="1" defaultChecked={Boolean(sp.mine)} className="accent-[var(--accent)]" />Assigned to me</label>
        <button type="submit" className="h-9 rounded-full border border-accent bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover">Apply</button>
        <Link href="/review" className="flex h-9 items-center text-[14px] text-muted hover:text-ink hover:underline">Reset</Link>
      </form>
      {q.rows.length === 0 ? (
        <EmptyState variant="inbox" title="Nothing matches" description={status === "PENDING_REVIEW" ? "No submissions are waiting for review." : "No submissions match these filters."} />
      ) : (
        <div className={tableCard}>
        <table className={table} data-testid="review-queue">
          <thead className={thead}>
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
                  <Link href={`/review/${r.submissionId}`} className="inline-flex h-8 items-center rounded-full border border-accent bg-accent px-3.5 text-[13px] font-medium text-white hover:bg-accent-hover">{r.status === "PENDING_REVIEW" ? "Review" : "View"}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}
