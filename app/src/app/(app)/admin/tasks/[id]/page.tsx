import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { Section, Table } from "@/components/admin/ui";
import { TaskEditor } from "@/components/admin/TaskEditor";
import { AssignPanel, ReferencePanel, TaskActions } from "@/components/admin/TaskPanels";
import { parseInstructions, summarizeReference } from "@/lib/admin/ops/tasks";
import { TRACKS } from "@/lib/admin/schemas";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const t = await db.taskTemplate.findUnique({
    where: { id },
    include: { program: { select: { id: true, name: true } }, assignments: { include: { user: { select: { id: true, name: true, email: true } }, reviewer: { select: { name: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!t) notFound();
  const [assets, siblings, trainees, reviewers] = await Promise.all([
    db.pointCloudAsset.findMany({ select: { id: true, name: true, isSynthetic: true }, orderBy: { name: "asc" } }),
    db.taskTemplate.findMany({ where: { programId: t.programId }, select: { id: true, code: true }, orderBy: { order: "asc" } }),
    db.user.findMany({ where: { role: "TRAINEE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { in: ["REVIEWER", "ADMIN"] }, passwordHash: { not: { startsWith: "!" } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const cfg = { ...((t.config ?? {}) as Record<string, unknown>) };
  const requiredOutput = Array.isArray(cfg.requiredOutput) ? (cfg.requiredOutput as string[]) : [];
  const reviewerErrorTags = Array.isArray(cfg.reviewerErrorTags) ? (cfg.reviewerErrorTags as Record<string, unknown>[]) : [];
  delete cfg.requiredOutput; delete cfg.reviewerErrorTags;
  const assigned = new Set(t.assignments.map((a) => a.userId));
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  return (
    <>
      <PageHeader title={`${t.code} - ${t.title}`} subtitle={`Program: ${t.program.name}`} />
      <Section title="Actions"><TaskActions id={t.id} code={t.code} isPublished={t.isPublished} assignments={t.assignments.length} /></Section>
      <TaskEditor
        key={t.id + t.assignments.length}
        assets={assets} tasks={siblings} tracks={TRACKS.map((x) => x.key)}
        initial={{
          id: t.id, title: t.title, description: t.description, objective: t.objective, learningOutcome: t.learningOutcome, difficulty: t.difficulty,
          prerequisiteTaskId: t.prerequisiteTaskId, annotationType: t.annotationType, estimatedMinutes: t.estimatedMinutes, instructions: parseInstructions(t.instructions),
          requiredOutput, expectedOutput: t.expectedOutput, hints: arr(t.hints), commonMistakes: arr(t.commonMistakes), scoringCriteria: t.scoringCriteria,
          reviewerRubric: Array.isArray(t.reviewerRubric) ? (t.reviewerRubric as Record<string, unknown>[]) : [], reviewerErrorTags, assetId: t.assetId,
          isPublished: t.isPublished, isRequiredForCertification: t.isRequiredForCertification, trackKey: t.trackKey, order: t.order, configBlocks: cfg,
        }}
      />
      <Section title="Reference annotation (hidden from trainees)">
        <ReferencePanel taskId={t.id} summary={summarizeReference(t.referenceAnnotation)} initialJson={t.referenceAnnotation ? JSON.stringify(t.referenceAnnotation, null, 2) : ""} />
      </Section>
      <Section title="Assign">
        <AssignPanel taskId={t.id} isPublished={t.isPublished} reviewers={reviewers} trainees={trainees.map((u) => ({ ...u, assigned: assigned.has(u.id) }))} />
      </Section>
      <Section title={`Assignments (${t.assignments.length})`}>
        <Table head={["Trainee", "Status", "Reviewer"]} empty={t.assignments.length ? undefined : "No assignments yet."}>
          {t.assignments.map((a) => (
            <tr key={a.id}><td>{a.user.name} <span className="text-muted">{a.user.email}</span></td><td><StatusBadge status={a.status as Status} /></td><td>{a.reviewer?.name ?? "-"}</td></tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
