import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureAssignments } from "@/lib/tasks/assignments";
import { annotationDocumentSchema } from "@/lib/annotation/types";
import { ADMIN_ONLY, defineOp, fail, okr } from "../types";
import { errorTagRowSchema, referenceSchema, rubricRowSchema, scoringCriteriaSchema, taskConfigBlocksSchema } from "../schemas";

const json = (v: unknown) => v as Prisma.InputJsonValue;
const ANN = ["INSPECTION", "IDENTIFICATION", "CUBOID", "SEMANTIC_SEG", "INSTANCE_SEG", "TRACKING", "ERROR_DETECTION", "MIXED"] as const;
const lines = z.array(z.string().trim().min(1).max(2000)).max(100);

/** Instructions are stored as one numbered line per step (the format used by seeds and read by the workspace). */
export const formatInstructions = (steps: string[]) => steps.map((s, i) => `${i + 1}. ${s.replace(/^\d+[.)]\s*/, "")}`).join("\n");
export const parseInstructions = (text: string) => text.split("\n").map((l) => l.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);

/** Convert an annotation-document-shaped JSON into the neutral reference format, or validate the reference format directly. */
export function parseReferenceJson(raw: unknown): { ok: true; value: z.infer<typeof referenceSchema> } | { ok: false; error: string } {
  const ref = referenceSchema.safeParse(raw);
  if (ref.success) return { ok: true, value: ref.data };
  const doc = annotationDocumentSchema.safeParse(raw);
  if (doc.success) {
    const frames = Object.entries(doc.data.frames).map(([k, f]) => ({ index: Number(k), cuboids: f.cuboids }));
    const first = frames.find((f) => f.index === 0) ?? frames[0];
    const value = referenceSchema.parse({ cuboids: first?.cuboids ?? [], ...(frames.length > 1 ? { frames } : {}) });
    return { ok: true, value };
  }
  return { ok: false, error: ref.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
}

export function summarizeReference(ref: unknown): { total: number; byClass: Record<string, number>; frames: number; hasPointLabels: boolean } | null {
  if (!ref || typeof ref !== "object") return null;
  const r = ref as { cuboids?: { label: string }[]; frames?: unknown[]; pointLabels?: unknown };
  const byClass: Record<string, number> = {};
  for (const c of r.cuboids ?? []) byClass[c.label] = (byClass[c.label] ?? 0) + 1;
  return { total: (r.cuboids ?? []).length, byClass, frames: r.frames?.length ?? 1, hasPointLabels: Boolean(r.pointLabels) };
}

async function syncProgramCertification(programId: string) {
  const p = await db.trainingProgram.findUnique({ where: { id: programId } });
  if (!p) return;
  const req = await db.taskTemplate.findMany({ where: { programId, isRequiredForCertification: true }, orderBy: { order: "asc" }, select: { code: true } });
  await db.trainingProgram.update({ where: { id: programId }, data: { certificationRequirements: json({ ...((p.certificationRequirements ?? {}) as object), requiredTaskCodes: req.map((t) => t.code) }) } });
}

const taskFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  objective: z.string().max(2000),
  learningOutcome: z.string().max(2000),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  prerequisiteTaskId: z.string().min(1).nullable(),
  annotationType: z.enum(ANN),
  estimatedMinutes: z.number().int().min(1).max(600),
  instructions: lines,
  requiredOutput: lines,
  expectedOutput: z.string().max(5000),
  hints: lines,
  commonMistakes: lines,
  scoringCriteria: scoringCriteriaSchema,
  reviewerRubric: z.array(rubricRowSchema).max(30),
  reviewerErrorTags: z.array(errorTagRowSchema).max(50),
  assetId: z.string().min(1),
  isPublished: z.boolean(),
  isRequiredForCertification: z.boolean(),
  trackKey: z.string().trim().min(1).nullable(),
  order: z.number().int().min(0).max(10000),
  config: taskConfigBlocksSchema,
};

export const taskUpdateInput = z.object({ id: z.string().min(1), ...taskFields });

export const taskOps = {
  "task.create": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ programId: z.string().min(1), code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/), title: z.string().trim().min(1).max(200), assetId: z.string().min(1), annotationType: z.enum(ANN).default("CUBOID") }),
    async run(_a, i) {
      if (await db.taskTemplate.findUnique({ where: { code: i.code } })) return fail(409, "Task code already exists.");
      const [p, a] = await Promise.all([db.trainingProgram.findUnique({ where: { id: i.programId } }), db.pointCloudAsset.findUnique({ where: { id: i.assetId } })]);
      if (!p || !a) return fail(404, "Program or asset not found.");
      const last = await db.taskTemplate.findFirst({ where: { programId: i.programId }, orderBy: { order: "desc" } });
      const t = await db.taskTemplate.create({
        data: {
          code: i.code, programId: i.programId, title: i.title, assetId: i.assetId, annotationType: i.annotationType, order: (last?.order ?? 0) + 1,
          scoringCriteria: json({ autoMetrics: [], reviewerWeight: 1 }), commonMistakes: [], hints: [], reviewerRubric: [], config: json({ requiredOutput: [], reviewerErrorTags: [] }),
        },
      });
      return okr({ id: t.id });
    },
  }),

  "task.update": defineOp({
    roles: ADMIN_ONLY,
    input: taskUpdateInput,
    async run(_a, i) {
      const t = await db.taskTemplate.findUnique({ where: { id: i.id } });
      if (!t) return fail(404, "Task not found.");
      if (!(await db.pointCloudAsset.findUnique({ where: { id: i.assetId } }))) return fail(400, "Asset not found.");
      if (i.prerequisiteTaskId) {
        if (i.prerequisiteTaskId === i.id) return fail(400, "A task cannot be its own prerequisite.");
        if (!(await db.taskTemplate.findUnique({ where: { id: i.prerequisiteTaskId } }))) return fail(400, "Prerequisite not found.");
      }
      // The JSON editor shows every config block (except the two structured ones), so the submitted blocks are authoritative.
      const config = { ...i.config, requiredOutput: i.requiredOutput, reviewerErrorTags: i.reviewerErrorTags };
      await db.taskTemplate.update({
        where: { id: i.id },
        data: {
          title: i.title, description: i.description, objective: i.objective, learningOutcome: i.learningOutcome, difficulty: i.difficulty,
          prerequisiteTaskId: i.prerequisiteTaskId, annotationType: i.annotationType, estimatedMinutes: i.estimatedMinutes,
          instructions: formatInstructions(i.instructions), expectedOutput: i.expectedOutput, hints: i.hints, commonMistakes: i.commonMistakes,
          scoringCriteria: json(i.scoringCriteria), reviewerRubric: json(i.reviewerRubric), assetId: i.assetId, isPublished: i.isPublished,
          isRequiredForCertification: i.isRequiredForCertification, trackKey: i.trackKey, order: i.order, config: json(config),
        },
      });
      if (i.isRequiredForCertification !== t.isRequiredForCertification) await syncProgramCertification(t.programId);
      let created = 0;
      if (i.isPublished && !t.isPublished) created = await ensureAssignmentsFor(t.programId);
      return okr({ assignmentsCreated: created });
    },
  }),

  "task.duplicate": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ id: z.string().min(1) }),
    async run(_a, i) {
      const t = await db.taskTemplate.findUnique({ where: { id: i.id } });
      if (!t) return fail(404, "Task not found.");
      let n = 1;
      while (await db.taskTemplate.findUnique({ where: { code: `${t.code}-COPY-${n}` } })) n++;
      const { id: _id, code, assetId, programId, prerequisiteTaskId, referenceAnnotation, initialAnnotation, config, ...rest } = t;
      void _id;
      const copy = await db.taskTemplate.create({
        data: {
          ...rest, code: `${code}-COPY-${n}`, title: `${t.title} (copy)`, isPublished: false, isRequiredForCertification: false,
          scoringCriteria: json(t.scoringCriteria), commonMistakes: json(t.commonMistakes), hints: json(t.hints), reviewerRubric: json(t.reviewerRubric),
          referenceAnnotation: referenceAnnotation === null ? Prisma.DbNull : json(referenceAnnotation),
          initialAnnotation: initialAnnotation === null ? Prisma.DbNull : json(initialAnnotation),
          config: config === null ? Prisma.DbNull : json(config),
          programId, assetId, prerequisiteTaskId,
        },
      });
      return okr({ id: copy.id, code: copy.code });
    },
  }),

  "task.setPublished": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ id: z.string().min(1), published: z.boolean() }),
    async run(_a, i) {
      const t = await db.taskTemplate.findUnique({ where: { id: i.id } });
      if (!t) return fail(404, "Task not found.");
      await db.taskTemplate.update({ where: { id: i.id }, data: { isPublished: i.published } });
      const created = i.published ? await ensureAssignmentsFor(t.programId) : 0;
      return okr({ assignmentsCreated: created });
    },
  }),

  "task.delete": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ id: z.string().min(1) }),
    async run(_a, i) {
      const t = await db.taskTemplate.findUnique({ where: { id: i.id }, include: { _count: { select: { assignments: true } } } });
      if (!t) return fail(404, "Task not found.");
      if (t._count.assignments > 0) return fail(409, `Task has ${t._count.assignments} assignment(s); unpublish it instead.`);
      await db.taskTemplate.delete({ where: { id: i.id } });
      if (t.isRequiredForCertification) await syncProgramCertification(t.programId);
      return okr({});
    },
  }),

  "task.assign": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ taskId: z.string().min(1), userIds: z.array(z.string().min(1)).max(2000).optional(), allEnrolled: z.boolean().optional() }),
    async run(actor, i) {
      const t = await db.taskTemplate.findUnique({ where: { id: i.taskId } });
      if (!t) return fail(404, "Task not found.");
      if (!t.isPublished) return fail(409, "Publish the task before assigning it.");
      let ids: string[];
      if (i.allEnrolled) ids = (await db.enrollment.findMany({ where: { programId: t.programId, user: { role: "TRAINEE" } }, select: { userId: true } })).map((e) => e.userId);
      else if (i.userIds?.length) ids = (await db.user.findMany({ where: { id: { in: i.userIds }, role: "TRAINEE" }, select: { id: true } })).map((u) => u.id);
      else return fail(400, "Choose trainees or 'all enrolled'.");
      const have = new Set((await db.taskAssignment.findMany({ where: { taskId: t.id, userId: { in: ids } }, select: { userId: true } })).map((a) => a.userId));
      const missing = ids.filter((u) => !have.has(u));
      if (missing.length) await db.taskAssignment.createMany({ data: missing.map((userId) => ({ taskId: t.id, userId, assignedById: actor.id })) });
      return okr({ created: missing.length, alreadyAssigned: ids.length - missing.length });
    },
  }),

  "assignment.setReviewer": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ taskId: z.string().min(1).optional(), userId: z.string().min(1).optional(), reviewerId: z.string().min(1).nullable() }),
    async run(_a, i) {
      if (!i.taskId && !i.userId) return fail(400, "Provide a task or a trainee.");
      if (i.reviewerId) {
        const r = await db.user.findUnique({ where: { id: i.reviewerId } });
        if (!r || r.role === "TRAINEE") return fail(400, "Reviewer must be a reviewer or admin.");
      }
      const res = await db.taskAssignment.updateMany({ where: { ...(i.taskId ? { taskId: i.taskId } : {}), ...(i.userId ? { userId: i.userId } : {}) }, data: { reviewerId: i.reviewerId } });
      return okr({ updated: res.count });
    },
  }),

  "task.setReference": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ id: z.string().min(1), reference: z.unknown().nullable() }),
    async run(_a, i) {
      const t = await db.taskTemplate.findUnique({ where: { id: i.id } });
      if (!t) return fail(404, "Task not found.");
      if (i.reference === null) {
        await db.taskTemplate.update({ where: { id: i.id }, data: { referenceAnnotation: Prisma.DbNull } });
        return okr({ summary: null });
      }
      const p = parseReferenceJson(i.reference);
      if (!p.ok) return fail(400, `Invalid reference annotation: ${p.error}`);
      await db.taskTemplate.update({ where: { id: i.id }, data: { referenceAnnotation: json(p.value) } });
      return okr({ summary: summarizeReference(p.value) });
    },
  }),
};

async function ensureAssignmentsFor(programId: string): Promise<number> {
  const enrolled = await db.enrollment.findMany({ where: { programId }, select: { userId: true } });
  let n = 0;
  for (const e of enrolled) n += await ensureAssignments(e.userId, programId);
  return n;
}
