import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listHistory, queueFilterOptions } from "@/lib/review/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { table, tableCard, thead, th, td, input } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";
const ctl = input;
type SP = Record<string, string | string[] | undefined>;

export default async function ReviewHistoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser(["REVIEWER", "ADMIN"]);
  const sp = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const [r, opts] = await Promise.all([listHistory(user, sp).catch(() => null), queueFilterOptions()]);
  const rows = r && r.ok ? r.rows : [];
  const admin = user.role === "ADMIN";
  return (
    <>
      <PageHeader title="Decision history" subtitle={admin ? "All review decisions." : "Decisions you have made."} />
      <p className="mb-4 text-[14px]"><Link href="/review" className="font-medium text-accent hover:underline">&larr; Back to queue</Link></p>
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 text-[12px] text-muted">
        <label className="flex flex-col gap-1">Decision
          <select name="decision" defaultValue={sp.decision ?? "ALL"} className={ctl}><option value="ALL">All</option><option value="APPROVE">Approved</option><option value="REQUEST_REVISION">Revision requested</option></select>
        </label>
        <label className="flex flex-col gap-1">Task
          <select name="taskId" defaultValue={sp.taskId ?? ""} className={ctl}><option value="">All</option>{opts.tasks.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1">Trainee
          <select name="traineeId" defaultValue={sp.traineeId ?? ""} className={ctl}><option value="">All</option>{opts.trainees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        {admin && (
          <label className="flex flex-col gap-1">Reviewer
            <select name="reviewerId" defaultValue={sp.reviewerId ?? ""} className={ctl}><option value="">All</option>{opts.reviewers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </label>
        )}
        <label className="flex flex-col gap-1">From<input type="date" name="from" defaultValue={sp.from ?? ""} className={ctl} /></label>
        <label className="flex flex-col gap-1">To<input type="date" name="to" defaultValue={sp.to ?? ""} className={ctl} /></label>
        <button type="submit" className="h-9 rounded-full border border-accent bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover">Apply</button>
        <Link href="/review/history" className="flex h-9 items-center text-[14px] text-muted hover:text-ink hover:underline">Reset</Link>
      </form>
      {rows.length === 0 ? <EmptyState variant="checklist" title="No decisions yet" description="Decisions appear here after you approve or request a revision." /> : (
        <div className={tableCard}><table className={table} data-testid="history-rows">
          <thead className={thead}><tr>{["Decided", "Trainee", "Task", "Attempt", "Decision", "Score", ...(admin ? ["Reviewer"] : []), "Feedback", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.decisionId}>
                <td className={`${td} whitespace-nowrap`}>{new Date(d.createdAt).toLocaleString()}</td>
                <td className={td}>{d.traineeName}</td>
                <td className={td}><span className="font-medium">{d.taskCode}</span> {d.taskTitle}</td>
                <td className={`${td} tabular-nums`}>{d.attempt}</td>
                <td className={td}>{d.decision === "APPROVE" ? "Approved" : "Revision requested"}</td>
                <td className={`${td} tabular-nums`}>{d.score ?? "-"}</td>
                {admin && <td className={td}>{d.reviewerName}</td>}
                <td className={`${td} max-w-[260px] text-[13px] text-muted`}>{d.feedback || "-"}</td>
                <td className={td}><Link href={`/review/${d.submissionId}`} className="font-medium text-accent hover:underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  );
}
