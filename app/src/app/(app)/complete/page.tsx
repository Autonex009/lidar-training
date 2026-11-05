import Link from "next/link";
import { requireSection } from "@/lib/guard";
import { getCompleteSummary, isStaff } from "@/lib/review/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: "Inspection", IDENTIFICATION: "Identification", CUBOID: "Cuboid", SEMANTIC_SEG: "Semantic segmentation",
  INSTANCE_SEG: "Instance segmentation", TRACKING: "Tracking", ERROR_DETECTION: "Error detection", MIXED: "Mixed",
};
const th = "border-b border-line px-2 py-1.5 text-left font-medium";
const td = "border-b border-line px-2 py-2 align-top";

function Bar({ value, total, label, testid }: { value: number; total: number; label: string; testid: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-2" data-testid={testid}>
      <div className="mb-0.5 flex justify-between text-[12px]"><span>{label}</span><span className="tabular-nums">{value} / {total} ({pct}%)</span></div>
      <div className="h-2 w-full max-w-[420px] overflow-hidden rounded border border-line bg-panel"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default async function CompletePage() {
  const user = await requireSection("complete");
  const s = await getCompleteSummary(user.id);
  return (
    <>
      <PageHeader title="Complete" subtitle={s.programName ?? "Approved tasks and certificate"} />
      {isStaff(user.role) && s.approved.length === 0 ? (
        <EmptyState title="Nothing to show for staff accounts" description="This tab lists a trainee's approved tasks and certificate. Reviewers and admins do not complete tasks, so it stays empty. Use Review to see trainee submissions." />
      ) : (
        <>
          <section className="mb-5" data-testid="progress">
            <Bar value={s.required.approved} total={s.required.total} label="Required tasks approved" testid="progress-required" />
            <Bar value={s.optional.approved} total={s.optional.total} label="Optional tasks approved" testid="progress-optional" />
          </section>
          <section className="mb-5" data-testid="certificate-section">
            <h2 className="mb-1 text-[13px] font-semibold">Certificate</h2>
            {s.certificate ? (
              <p className="text-[13px]">Issued {new Date(s.certificate.issuedAt).toLocaleDateString()}.{" "}
                <Link href="/complete/certificate" className="inline-flex h-7 items-center rounded-full border border-accent bg-accent text-white px-3 font-medium hover:bg-accent-hover" data-testid="view-certificate">View certificate</Link></p>
            ) : s.required.remaining.length === 0 && s.required.total === 0 ? (
              <p className="text-[13px] text-muted">This program has no required tasks configured, so no certificate is issued.</p>
            ) : (
              <>
                <p className="mb-1 text-[13px] text-muted">The certificate is issued automatically when every required task is approved. Remaining:</p>
                <table className="w-full max-w-[640px] border border-line text-[13px]" data-testid="remaining-required">
                  <tbody>
                    {s.required.remaining.map((r) => (
                      <tr key={r.code}><td className={`${td} font-medium`}>{r.code}</td><td className={td}>{r.title}</td><td className={td}><StatusBadge status={r.status as Status} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
          <h2 className="mb-1 text-[13px] font-semibold">Approved tasks</h2>
          {s.approved.length === 0 ? (
            <EmptyState title="No approved tasks yet" description="Tasks appear here once a reviewer approves them. Check the Review tab for the status of your submissions." action={<Link href="/review" className="text-[13px] underline">Go to Review</Link>} />
          ) : (
            <table className="w-full border border-line text-[13px]" data-testid="approved-table">
              <thead className="bg-panel text-[12px] text-muted"><tr>{["Task", "Title", "Type", "Completed", "Reviewer", "Score", "Feedback", "Attempts", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {s.approved.map((r) => (
                  <tr key={r.code} data-testid={`approved-${r.code}`}>
                    <td className={`${td} font-medium`}>{r.code}</td><td className={td}>{r.title}</td><td className={td}>{TYPE_LABEL[r.annotationType] ?? r.annotationType}</td>
                    <td className={`${td} whitespace-nowrap`}>{new Date(r.completedAt).toLocaleDateString()}</td><td className={td}>{r.reviewerName}</td>
                    <td className={`${td} tabular-nums`}>{r.score ?? "-"}</td><td className={`${td} max-w-[260px] text-[12px] text-muted`}>{r.feedback || "-"}</td>
                    <td className={`${td} tabular-nums`}>{r.attempts}</td><td className={td}><StatusBadge status="COMPLETED" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
