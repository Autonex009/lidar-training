import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadProjectConfigs } from "@/lib/project-config";
import { seedFoundationsContent, seedProjectProgram } from "@/lib/learn/seed-content";
import { seedFoundationTasks, seedTonicTasks } from "@/lib/tasks/seed-tasks";
import { ensureAssignmentsForProgram } from "@/lib/tasks/assignments";
import { ADMIN_ONLY, defineOp, fail, okr, type OpResult } from "../types";
import { TRACKS, labelSchemaSchema } from "../schemas";

const json = (v: unknown) => v as Prisma.InputJsonValue;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "program";
const QUESTION_KINDS = ["MULTIPLE_CHOICE", "TRUE_FALSE", "INTERPRETATION", "IDENTIFY_INCORRECT", "CHOOSE_DECISION", "IDENTIFY_OBJECT"] as const;

/** Persist enabled tracks and make modules mandatory/optional and track-gated tasks published/unpublished consistently. */
export async function applyEnabledTracks(programId: string, tracks: string[]) {
  const valid = new Set(TRACKS.map((t) => t.key));
  const list = [...new Set(tracks)].filter((t) => valid.has(t));
  await db.$transaction([
    db.trainingProgram.update({ where: { id: programId }, data: { enabledTracks: json(list) } }),
    db.module.updateMany({ where: { programId, trackKey: { in: list } }, data: { isMandatory: true } }),
    db.module.updateMany({ where: { programId, trackKey: { not: null, notIn: list } }, data: { isMandatory: false } }),
    db.taskTemplate.updateMany({ where: { programId, trackKey: { in: list } }, data: { isPublished: true } }),
    db.taskTemplate.updateMany({ where: { programId, trackKey: { not: null, notIn: list } }, data: { isPublished: false } }),
  ]);
  await ensureAssignmentsForProgram(db, programId);
  return list;
}

/** Re-run the content seeds for a program. Overwrites authored content/fields with the source (idempotent). */
export async function reimportProgram(programId: string): Promise<OpResult<{ notes: string[] }>> {
  const program = await db.trainingProgram.findUnique({ where: { id: programId } });
  if (!program) return fail(404, "Program not found.");
  const notes: string[] = [];
  const cfg = loadProjectConfigs().find((c) => c.slug === program.slug);
  if (cfg) {
    await seedProjectProgram(db, cfg);
    notes.push("Program settings, schema, modules and quizzes re-imported from project config.");
  } else if (program.slug === "foundations") {
    await seedFoundationsContent(db, program.id);
    notes.push("Foundations modules and quizzes re-imported.");
  } else {
    return fail(400, "This program has no project-config folder or built-in content to re-import from.");
  }
  try {
    const n = program.slug === "foundations" ? await seedFoundationTasks(db) : program.slug === "tonic" ? await seedTonicTasks(db) : 0;
    if (n) notes.push(`${n} task templates re-imported.`);
  } catch (e) {
    notes.push(`Task templates skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
  return okr({ notes });
}

export const programOps = {
  "program.create": defineOp({
    roles: ADMIN_ONLY,
    input: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("blank"), name: z.string().trim().min(1).max(200), withFoundationsModules: z.boolean().default(true) }),
      z.object({ mode: z.literal("config"), slug: z.string().min(1) }),
    ]),
    async run(_a, i) {
      if (i.mode === "config") {
        const cfg = loadProjectConfigs().find((c) => c.slug === i.slug);
        if (!cfg) return fail(404, `No project-config folder "${i.slug}".`);
        if (await db.trainingProgram.findUnique({ where: { slug: cfg.slug } })) return fail(409, "That project config is already imported (use Re-import on the program).");
        const p = await seedProjectProgram(db, cfg);
        const notes: string[] = [];
        if (cfg.slug === "tonic") {
          try { notes.push(`${await seedTonicTasks(db)} task templates created.`); } catch (e) { notes.push(`Task templates skipped: ${e instanceof Error ? e.message : String(e)}`); }
        }
        return okr({ id: p.id, slug: p.slug, notes });
      }
      let slug = slugify(i.name);
      for (let n = 2; await db.trainingProgram.findUnique({ where: { slug } }); n++) slug = `${slugify(i.name)}-${n}`;
      const p = await db.trainingProgram.create({
        data: { name: i.name, slug, labelSchema: json({ classes: [], attributes: [] }), enabledTracks: json([]), certificationRequirements: json({ requiredTaskCodes: [] }) },
      });
      if (i.withFoundationsModules) await seedFoundationsContent(db, p.id);
      return okr({ id: p.id, slug: p.slug, notes: [] as string[] });
    },
  }),

  "program.update": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1).max(200),
      description: z.string().max(5000),
      passingScore: z.number().int().min(0).max(100),
      navigationProfile: z.enum(["orbit", "fly"]),
      upAxis: z.enum(["Z", "Y"]),
      yawConvention: z.string().trim().min(1).max(60),
      boxDefinition: z.string().trim().min(1).max(60),
      isActive: z.boolean(),
      labelSchema: labelSchemaSchema,
      enabledTracks: z.array(z.string()),
      requiredTaskCodes: z.array(z.string()),
    }),
    async run(_a, i) {
      const p = await db.trainingProgram.findUnique({ where: { id: i.id } });
      if (!p) return fail(404, "Program not found.");
      const codes = new Set((await db.taskTemplate.findMany({ where: { programId: i.id }, select: { code: true } })).map((t) => t.code));
      const bad = i.requiredTaskCodes.filter((c) => !codes.has(c));
      if (bad.length) return fail(400, `Unknown task codes: ${bad.join(", ")}`);
      const certReq = { ...((p.certificationRequirements ?? {}) as object), requiredTaskCodes: i.requiredTaskCodes };
      await db.trainingProgram.update({
        where: { id: i.id },
        data: {
          name: i.name, description: i.description, passingScore: i.passingScore, navigationProfile: i.navigationProfile, upAxis: i.upAxis,
          yawConvention: i.yawConvention, boxDefinition: i.boxDefinition, isActive: i.isActive, labelSchema: json(i.labelSchema), certificationRequirements: json(certReq),
        },
      });
      await db.taskTemplate.updateMany({ where: { programId: i.id, code: { in: i.requiredTaskCodes } }, data: { isRequiredForCertification: true } });
      await db.taskTemplate.updateMany({ where: { programId: i.id, code: { notIn: i.requiredTaskCodes } }, data: { isRequiredForCertification: false } });
      const tracks = await applyEnabledTracks(i.id, i.enabledTracks);
      return okr({ enabledTracks: tracks });
    },
  }),

  "program.reimport": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ id: z.string().min(1) }),
    run: (_a, i) => reimportProgram(i.id),
  }),

  "module.update": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ id: z.string().min(1), title: z.string().trim().min(1).max(200), summary: z.string().max(2000), estimatedMinutes: z.number().int().min(1).max(240), isMandatory: z.boolean() }),
    async run(_a, { id, ...data }) {
      const r = await db.module.updateMany({ where: { id }, data });
      return r.count ? okr({}) : fail(404, "Module not found.");
    },
  }),

  "module.reorder": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ programId: z.string().min(1), moduleIds: z.array(z.string().min(1)).min(1) }),
    async run(_a, i) {
      const existing = await db.module.findMany({ where: { programId: i.programId }, select: { id: true } });
      const set = new Set(existing.map((m) => m.id));
      if (set.size !== i.moduleIds.length || !i.moduleIds.every((m) => set.has(m))) return fail(400, "moduleIds must list every module of the program exactly once.");
      await db.$transaction(i.moduleIds.map((id, idx) => db.module.update({ where: { id }, data: { order: idx + 1 } })));
      return okr({});
    },
  }),

  "question.save": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({
      id: z.string().min(1).optional(),
      programId: z.string().min(1),
      moduleId: z.string().min(1).nullable(),
      kind: z.enum(QUESTION_KINDS),
      prompt: z.string().trim().min(1).max(2000),
      options: z.array(z.string().trim().min(1)).max(10).default([]),
      correctAnswer: z.union([z.number().int().min(0), z.boolean()]),
      explanation: z.string().max(4000).default(""),
    }),
    async run(_a, i) {
      if (i.kind === "TRUE_FALSE") {
        if (typeof i.correctAnswer !== "boolean") return fail(400, "True/false questions need a boolean answer.");
      } else {
        if (i.options.length < 2) return fail(400, "Choice questions need at least two options.");
        if (typeof i.correctAnswer !== "number" || i.correctAnswer >= i.options.length) return fail(400, "Correct answer must be a valid option index.");
      }
      if (i.moduleId) {
        const m = await db.module.findFirst({ where: { id: i.moduleId, programId: i.programId } });
        if (!m) return fail(404, "Module not found in this program.");
      }
      const data = { kind: i.kind, prompt: i.prompt, options: json(i.kind === "TRUE_FALSE" ? [] : i.options), correctAnswer: json(i.correctAnswer), explanation: i.explanation };
      if (i.id) {
        const r = await db.quizQuestion.updateMany({ where: { id: i.id, programId: i.programId, moduleId: i.moduleId }, data });
        return r.count ? okr({ id: i.id }) : fail(404, "Question not found.");
      }
      const last = await db.quizQuestion.findFirst({ where: { programId: i.programId, moduleId: i.moduleId }, orderBy: { order: "desc" } });
      const q = await db.quizQuestion.create({ data: { ...data, programId: i.programId, moduleId: i.moduleId, order: (last?.order ?? -1) + 1 } });
      return okr({ id: q.id });
    },
  }),

  "question.delete": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ id: z.string().min(1) }),
    async run(_a, i) {
      const q = await db.quizQuestion.findUnique({ where: { id: i.id } });
      if (!q) return fail(404, "Question not found.");
      await db.quizQuestion.delete({ where: { id: i.id } });
      const rest = await db.quizQuestion.findMany({ where: { programId: q.programId, moduleId: q.moduleId }, orderBy: { order: "asc" } });
      await db.$transaction(rest.map((r, idx) => db.quizQuestion.update({ where: { id: r.id }, data: { order: idx } })));
      return okr({});
    },
  }),
};
