import { requireSection } from "@/lib/guard";
import { getCompleteSummary, isStaff } from "@/lib/review/service";
import { table, tableCard, thead, th, td } from "@/components/ui/table";
import { Ring } from "@/components/ui/Ring";
import { ButtonLink } from "@/components/ui/Button";
import { UIcon } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: "Inspection", IDENTIFICATION: "Identification", CUBOID: "Cuboid", SEMANTIC_SEG: "Semantic segmentation",
  INSTANCE_SEG: "Instance segmentation", TRACKING: "Tracking", ERROR_DETECTION: "Error detection", MIXED: "Mixed",
};
function Bar({ value, total, label, testid }: { value: number; total: number; label: string; testid: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div data-testid={testid}>
      <div className="mb-1.5 flex justify-between text-[14px]"><span className="text-body">{label}</span><span className="tabular-nums text-ink">{value} / {total} ({pct}%)</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line"><div className="h-full grad-bar" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default async function CompletePage() {
  const user = await requireSection("complete");
  const s = await getCompleteSummary(user.id);
  const reqPct = s.required.total ? Math.round((s.required.approved / s.required.total) * 100) : 0;
  return (
    <>
      <PageHeader title="Complete" subtitle={s.programName ?? "Approved tasks and certificate"} />
      {isStaff(user.role) && s.approved.length === 0 ? (
        <EmptyState variant="checklist" title="Nothing to show for staff accounts" description="This tab lists a trainee's approved tasks and certificate. Reviewers and admins do not complete tasks, so it stays empty. Use Review to see trainee submissions." />
      ) : (
        <>
          <div className="mb-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-xl border border-line bg-surface p-6 shadow-float" data-testid="progress">
              <div className="mb-5 flex items-center gap-5">
                <Ring value={reqPct} size={64} label={`Required tasks ${reqPct}%`} />
                <div>
                  <h2 className="text-[16px] font-semibold text-ink">Your progress</h2>
                  <p className="text-[14px] text-muted">{s.required.approved} of {s.required.total} required tasks approved</p>
                </div>
              </div>
              <div className="space-y-4">
                <Bar value={s.required.approved} total={s.required.total} label="Required tasks approved" testid="progress-required" />
                <Bar value={s.optional.approved} total={s.optional.total} label="Optional tasks approved" testid="progress-optional" />
              </div>
            </section>
            <section data-testid="certificate-section" className={`rounded-xl p-px ${s.certificate ? "grad-bar shadow-float" : "bg-line"}`}>
              <div className="h-full rounded-[11px] bg-surface p-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.certificate ? "bg-accent-tint text-accent" : "bg-panel text-muted"}`}><UIcon name="award" size={20} /></span>
                  <h2 className="text-[16px] font-semibold text-ink">Certificate</h2>
                </div>
                {s.certificate ? (
                  <>
                    <p className="mb-4 text-[14px] text-body">Issued {new Date(s.certificate.issuedAt).toLocaleDateString()}. Every required task has been approved.</p>
                    <ButtonLink href="/complete/certificate" variant="primary" size="lg" data-testid="view-certificate">View certificate</ButtonLink>
                  </>
                ) : s.required.remaining.length === 0 && s.required.total === 0 ? (
                  <p className="text-[14px] text-muted">This program has no required tasks configured, so no certificate is issued.</p>
                ) : (
                  <>
                    <p className="mb-3 text-[14px] text-muted">The certificate is issued automatically when every required task is approved. Remaining:</p>
                    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line" data-testid="remaining-required">
                      {s.required.remaining.map((r) => (
                        <li key={r.code} className="flex items-center gap-3 px-4 py-3 text-[14px]"><span className="font-semibold text-ink">{r.code}</span><span className="min-w-0 flex-1 truncate text-body">{r.title}</span><StatusBadge status={r.status as Status} /></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>
          <h2 className="mb-3 text-[16px] font-semibold text-ink">Approved tasks</h2>
          {s.approved.length === 0 ? (
            <EmptyState variant="checklist" title="No approved tasks yet" description="Tasks appear here once a reviewer approves them. Check the Review tab for the status of your submissions." action={<ButtonLink href="/review" variant="primary">Go to Review</ButtonLink>} />
          ) : (
            <div className={tableCard}>
              <table className={table} data-testid="approved-table">
                <thead className={thead}><tr>{["Task", "Title", "Type", "Completed", "Reviewer", "Score", "Feedback", "Attempts", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {s.approved.map((r) => (
                    <tr key={r.code} data-testid={`approved-${r.code}`}>
                      <td className={`${td} font-semibold`}>{r.code}</td><td className={td}>{r.title}</td><td className={td}>{TYPE_LABEL[r.annotationType] ?? r.annotationType}</td>
                      <td className={`${td} whitespace-nowrap`}>{new Date(r.completedAt).toLocaleDateString()}</td><td className={td}>{r.reviewerName}</td>
                      <td className={`${td} tabular-nums`}>{r.score ?? "-"}</td><td className={`${td} max-w-[260px] text-[13px] text-muted`}>{r.feedback || "-"}</td>
                      <td className={`${td} tabular-nums`}>{r.attempts}</td><td className={td}><StatusBadge status="COMPLETED" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
