import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { inputCls } from "@/components/admin/ui";
import { loadDashboard } from "@/lib/admin/queries";
import { formatDuration } from "@/lib/admin/stats";
import { parseDate } from "@/lib/admin/filters";

type SP = Promise<{ program?: string; from?: string; to?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const programs = await db.trainingProgram.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const s = await loadDashboard({ programId: sp.program || undefined, from: parseDate(sp.from), to: parseDate(sp.to, true) });
  const bucketLink = (b: string) => `/admin/trainees?role=TRAINEE&bucket=${b}${sp.program ? `&program=${sp.program}` : ""}`;
  const cells: { label: string; value: string | number; href?: string }[] = [
    { label: "Total trainees", value: s.totalTrainees, href: `/admin/trainees?role=TRAINEE${sp.program ? `&program=${sp.program}` : ""}` },
    { label: "Not started", value: s.notStarted, href: bucketLink("not_started") },
    { label: "Learning in progress", value: s.learningInProgress, href: bucketLink("learning") },
    { label: "Learning completed", value: s.learningCompleted },
    { label: "Assessment failed", value: s.assessmentFailed, href: bucketLink("assessment_failed") },
    { label: "Annotation in progress", value: s.annotationInProgress, href: bucketLink("annotating") },
    { label: "Pending review", value: s.pendingReview, href: bucketLink("pending_review") },
    { label: "Revision required", value: s.revisionRequired, href: bucketLink("revision_required") },
    { label: "Completed training", value: s.completed, href: bucketLink("completed") },
  ];
  const avgs = [
    { label: "Avg assessment score (latest attempts)", value: s.avgAssessmentScore === null ? "n/a" : `${s.avgAssessmentScore}%` },
    { label: "Avg task score (approved)", value: s.avgTaskScore === null ? "n/a" : String(s.avgTaskScore) },
    { label: "Avg time to completion", value: formatDuration(s.avgTimeToCompletionMs) },
  ];
  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Trainee progress across the program. Counts are per trainee and overlap (a completed trainee is also learning-completed)." />
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 text-[13px]" method="get">
        <label className="flex flex-col gap-1"><span className="text-muted">Program</span>
          <select name="program" defaultValue={sp.program ?? ""} className={inputCls}><option value="">All programs</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-muted">Registered from</span><input type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} /></label>
        <label className="flex flex-col gap-1"><span className="text-muted">Registered to</span><input type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} /></label>
        <Button type="submit">Apply</Button>
        <Link href="/admin" className="text-[14px] text-muted hover:text-ink hover:underline">Reset</Link>
      </form>
      <h2 className="mb-3 text-[16px] font-semibold text-ink">Trainees</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="stats-strip">
        {cells.map((c) => {
          const inner = (
            <>
              <p className="text-[24px] font-bold leading-8 tabular-nums text-ink">{c.value}</p>
              <p className="mt-0.5 text-[14px] text-muted">{c.label}</p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="rounded-xl border border-line bg-surface p-4 hover:border-accent/40 hover:shadow-float">{inner}</Link>
          ) : (
            <div key={c.label} className="rounded-xl border border-line bg-surface p-4">{inner}</div>
          );
        })}
      </div>
      <h2 className="mb-3 text-[16px] font-semibold text-ink">Averages</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {avgs.map((a) => (
          <div key={a.label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-[24px] font-bold leading-8 tabular-nums text-ink">{a.value}</p>
            <p className="mt-0.5 text-[14px] text-muted">{a.label}</p>
          </div>
        ))}
      </div>
    </>
  );
}
