import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Section, Table, linkCls } from "@/components/admin/ui";
import { NewProgramForm } from "@/components/admin/NewProgramForm";
import { loadProjectConfigs } from "@/lib/project-config";

export default async function ProgramsPage() {
  await requireUser(["ADMIN"]);
  const programs = await db.trainingProgram.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { modules: true, tasks: true, enrollments: true } } },
  });
  const imported = new Set(programs.map((p) => p.slug));
  let configs: { slug: string; name: string }[] = [];
  let configError: string | null = null;
  try { configs = loadProjectConfigs().map((c) => ({ slug: c.slug, name: c.name })); } catch (e) { configError = e instanceof Error ? e.message : String(e); }
  return (
    <>
      <PageHeader title="Programs" />
      <Table head={["Name", "Slug", "Active", "Passing", "Modules", "Tasks", "Enrolled"]}>
        {programs.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/admin/programs/${p.id}`} className={linkCls}>{p.name}</Link></td>
            <td><code>{p.slug}</code></td>
            <td>{p.isActive ? <Badge tone="ok">active</Badge> : <Badge>inactive</Badge>}</td>
            <td className="tabular-nums">{p.passingScore}%</td>
            <td className="tabular-nums">{p._count.modules}</td><td className="tabular-nums">{p._count.tasks}</td><td className="tabular-nums">{p._count.enrollments}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-6" />
      <Section title="New program">
        {configError ? <p className="mb-2 text-[13px] text-red-700">Could not read project configs: {configError}</p> : null}
        <NewProgramForm availableConfigs={configs.filter((c) => !imported.has(c.slug))} />
      </Section>
    </>
  );
}
