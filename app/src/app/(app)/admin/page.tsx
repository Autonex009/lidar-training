import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Section, inputCls } from "@/components/admin/ui";
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
      <form className="mb-5 flex flex-wrap items-end gap-3 text-[13px]" method="get">
        <label className="flex flex-col gap-1"><span className="text-muted">Program</span>
          <select name="program" defaultValue={sp.program ?? ""} className={inputCls}><option value="">All programs</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-muted">Registered from</span><input type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} /></label>
        <label className="flex flex-col gap-1"><span className="text-muted">Registered to</span><input type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} /></label>
        <Button type="submit">Apply</Button>
        <Link href="/admin" className="text-muted underline">Reset</Link>
      </form>
      <Section title="Trainees">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]" data-testid="stats-strip">
            <thead><tr className="border-b border-line text-left text-muted">{cells.map((c) => <th key={c.label} className="px-2 py-1.5 font-medium">{c.label}</th>)}</tr></thead>
            <tbody><tr>{cells.map((c) => (
              <td key={c.label} className="px-2 py-2 text-xl font-semibold tabular-nums">{c.href ? <Link href={c.href} className="hover:underline">{c.value}</Link> : c.value}</td>
            ))}</tr></tbody>
          </table>
        </div>
      </Section>
      <Section title="Averages">
        <table className="border-collapse text-[13px]"><tbody>
          {avgs.map((a) => <tr key={a.label} className="border-b border-line"><td className="py-1.5 pr-8 text-muted">{a.label}</td><td className="py-1.5 font-semibold tabular-nums">{a.value}</td></tr>)}
        </tbody></table>
      </Section>
    </>
  );
}
