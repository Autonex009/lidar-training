import Link from "next/link";
import type { Role } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Table, fmtDate, inputCls, linkCls } from "@/components/admin/ui";
import { UserControls } from "@/components/admin/UserControls";
import { listTrainees } from "@/lib/admin/queries";
import { BUCKET_LABELS, type StatusBucket } from "@/lib/admin/stats";

type SP = Promise<{ q?: string; role?: string; program?: string; bucket?: string }>;

export default async function TraineesPage({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const role = ["TRAINEE", "REVIEWER", "ADMIN"].includes(sp.role ?? "") ? (sp.role as Role) : undefined;
  const bucket = sp.bucket && sp.bucket in BUCKET_LABELS ? (sp.bucket as StatusBucket) : undefined;
  const [rows, programs, enr] = await Promise.all([
    listTrainees({ q: sp.q?.trim() || undefined, role, programId: sp.program || undefined, bucket }),
    db.trainingProgram.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.enrollment.findMany({ select: { userId: true, programId: true } }),
  ]);
  const enrolledBy = new Map<string, string[]>();
  for (const e of enr) enrolledBy.set(e.userId, [...(enrolledBy.get(e.userId) ?? []), e.programId]);
  return (
    <>
      <PageHeader title="Trainees" subtitle={`${rows.length} shown`} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1"><span className="text-muted">Search</span><input name="q" defaultValue={sp.q ?? ""} placeholder="name or email" className={inputCls} /></label>
        <label className="flex flex-col gap-1"><span className="text-muted">Role</span>
          <select name="role" defaultValue={role ?? ""} className={inputCls}><option value="">Any</option>{["TRAINEE", "REVIEWER", "ADMIN"].map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="text-muted">Program</span>
          <select name="program" defaultValue={sp.program ?? ""} className={inputCls}><option value="">Any</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="text-muted">Status</span>
          <select name="bucket" defaultValue={bucket ?? ""} className={inputCls}><option value="">Any</option>{Object.entries(BUCKET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <Button type="submit">Filter</Button>
        <Link href="/admin/trainees" className="text-muted underline">Reset</Link>
      </form>
      <Table head={["Name", "Email", "Role", "Program", "Status", "Learn %", "Tasks approved", "Last active", "Actions"]} empty={rows.length ? undefined : "No matching users."}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/admin/trainees/${r.id}`} className={linkCls}>{r.name}</Link></td>
            <td>{r.email}</td>
            <td>{r.role}</td>
            <td>{r.programName ?? "-"}</td>
            <td>{r.bucket ? BUCKET_LABELS[r.bucket] : "-"}</td>
            <td className="tabular-nums">{r.learnPercent === null ? "-" : `${r.learnPercent}%`}</td>
            <td className="tabular-nums">{r.approved}/{r.totalTasks}</td>
            <td className="whitespace-nowrap">{fmtDate(r.lastActiveAt)}</td>
            <td><UserControls userId={r.id} role={r.role} programs={programs} enrolledIds={enrolledBy.get(r.id) ?? []} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
