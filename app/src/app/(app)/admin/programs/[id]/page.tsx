import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/admin/ui";
import { OpButton } from "@/components/admin/client";
import { ProgramSettingsForm } from "@/components/admin/ProgramSettingsForm";
import { ModulesEditor } from "@/components/admin/ModulesEditor";
import { QuizEditor, type QuestionValue } from "@/components/admin/QuizEditor";
import type { LabelSchemaValue } from "@/components/admin/LabelSchemaEditor";
import { TRACKS } from "@/lib/admin/schemas";

type SP = Promise<{ tab?: string; module?: string }>;

export default async function ProgramPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const program = await db.trainingProgram.findUnique({ where: { id } });
  if (!program) notFound();
  const tab = sp.tab === "modules" || sp.tab === "quiz" ? sp.tab : "settings";
  const base = `/admin/programs/${id}`;
  const schema = (program.labelSchema ?? {}) as Partial<LabelSchemaValue>;
  const cert = (program.certificationRequirements ?? {}) as { requiredTaskCodes?: string[] };

  let body: React.ReactNode;
  if (tab === "settings") {
    const tasks = await db.taskTemplate.findMany({ where: { programId: id }, orderBy: { order: "asc" }, select: { code: true, title: true } });
    body = (
      <ProgramSettingsForm
        key={program.id}
        tracks={TRACKS}
        tasks={tasks}
        initial={{
          id: program.id, name: program.name, description: program.description, passingScore: program.passingScore, navigationProfile: program.navigationProfile,
          upAxis: program.upAxis, yawConvention: program.yawConvention, boxDefinition: program.boxDefinition, isActive: program.isActive,
          labelSchema: { ...schema, classes: (schema.classes ?? []).map((c) => (typeof c === "string" ? { name: c } : c)), attributes: schema.attributes ?? [] },
          enabledTracks: Array.isArray(program.enabledTracks) ? (program.enabledTracks as string[]) : [], requiredTaskCodes: cert.requiredTaskCodes ?? [],
        }}
      />
    );
  } else if (tab === "modules") {
    const modules = await db.module.findMany({ where: { programId: id }, orderBy: { order: "asc" }, include: { _count: { select: { lessons: true, questions: true } } } });
    body = <ModulesEditor key={modules.map((m) => m.id).join()} programId={id} initial={modules.map((m) => ({ id: m.id, key: m.key, title: m.title, summary: m.summary, estimatedMinutes: m.estimatedMinutes, isMandatory: m.isMandatory, trackKey: m.trackKey, lessons: m._count.lessons, questions: m._count.questions }))} />;
  } else {
    const modules = await db.module.findMany({ where: { programId: id }, orderBy: { order: "asc" }, select: { id: true, title: true } });
    const sel = sp.module === "final" || !modules.some((m) => m.id === sp.module) ? (sp.module === "final" || modules.length === 0 ? "final" : modules[0].id) : sp.module!;
    const moduleId = sel === "final" ? null : sel;
    const qs = await db.quizQuestion.findMany({ where: { programId: id, moduleId }, orderBy: { order: "asc" } });
    const values: QuestionValue[] = qs.map((q) => ({
      id: q.id, kind: q.kind, prompt: q.prompt, options: Array.isArray(q.options) ? (q.options as string[]) : [],
      correctAnswer: q.correctAnswer as number | boolean, explanation: q.explanation,
    }));
    body = (
      <div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {modules.map((m) => <Link key={m.id} href={`${base}?tab=quiz&module=${m.id}`} className={sel === m.id ? "font-semibold underline" : "text-muted hover:text-ink"}>{m.title}</Link>)}
          <Link href={`${base}?tab=quiz&module=final`} className={sel === "final" ? "font-semibold underline" : "text-muted hover:text-ink"}>Final assessment</Link>
        </div>
        <QuizEditor key={sel + qs.map((q) => q.id).join()} programId={id} moduleId={moduleId} questions={values} />
      </div>
    );
  }
  return (
    <>
      <PageHeader title={program.name} subtitle={`slug: ${program.slug}`} />
      <div className="mb-3 flex items-start gap-3">
        <OpButton op="program.reimport" input={{ id }} label="Re-import from project config" confirm="Re-import overwrites program settings, modules, quizzes and seeded task templates with the source content. Admin edits to those will be lost. Continue?" />
      </div>
      <Tabs current={tab} items={[{ key: "settings", label: "Settings", href: base }, { key: "modules", label: "Modules", href: `${base}?tab=modules` }, { key: "quiz", label: "Quizzes", href: `${base}?tab=quiz` }]} />
      {body}
    </>
  );
}
