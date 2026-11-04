import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, Table, inputCls, linkCls } from "@/components/admin/ui";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const [programs, tasks] = await Promise.all([
    db.trainingProgram.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.taskTemplate.findMany({
      where: sp.program ? { programId: sp.program } : {}, orderBy: [{ programId: "asc" }, { order: "asc" }],
      include: { program: { select: { name: true } }, asset: { select: { name: true } }, _count: { select: { assignments: true } } },
    }),
  ]);
  return (
    <>
      <PageHeader title="Tasks" subtitle={`${tasks.length} task templates`} />
      <div className="mb-3 flex flex-wrap items-end gap-3 text-[13px]">
        <form method="get" className="flex items-end gap-2">
          <select name="program" defaultValue={sp.program ?? ""} className={inputCls}><option value="">All programs</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <Button type="submit">Filter</Button>
        </form>
        <Link href="/admin/tasks/new" className={linkCls}>New task</Link>
      </div>
      <Table head={["Code", "Title", "Program", "Type", "Difficulty", "Published", "Cert.", "Track", "Asset", "Assignments"]}>
        {tasks.map((t) => (
          <tr key={t.id}>
            <td><Link href={`/admin/tasks/${t.id}`} className={linkCls}>{t.code}</Link></td>
            <td>{t.title}</td><td>{t.program.name}</td><td>{t.annotationType}</td><td>{t.difficulty}</td>
            <td>{t.isPublished ? <Badge tone="ok">published</Badge> : <Badge>draft</Badge>}</td>
            <td>{t.isRequiredForCertification ? "yes" : "-"}</td><td>{t.trackKey ?? "-"}</td><td>{t.asset.name}</td>
            <td className="tabular-nums">{t._count.assignments}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
