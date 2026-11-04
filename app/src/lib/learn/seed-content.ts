import { Prisma, type PrismaClient } from "@prisma/client";
import { foundations, tonicProjectModules, tonicFinalAssessmentExtra } from "@/content";
import type { ModuleContent, QuizQuestionContent } from "@/content";
import type { ProjectConfig } from "@/lib/project-config";

/** DB LessonKind has no schema kind; the authored kind is kept inside Lesson.content. */
function dbLessonKind(kind: string): "TEXT" | "INTERACTIVE_CLOUD" | "INTERACTIVE_CUBOID" | "INTERACTIVE_NAV" {
  return kind === "INTERACTIVE_CLOUD" || kind === "INTERACTIVE_CUBOID" || kind === "INTERACTIVE_NAV" ? kind : "TEXT";
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

async function upsertQuestions(prisma: PrismaClient, programId: string, moduleId: string | null, questions: QuizQuestionContent[]) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const data = {
      kind: q.kind,
      prompt: q.prompt,
      options: json(q.options ?? []),
      correctAnswer: json(q.correctAnswer),
      explanation: q.explanation,
      media: q.media ? json(q.media) : Prisma.DbNull,
    };
    const existing = await prisma.quizQuestion.findFirst({ where: { programId, moduleId, order: i } });
    if (existing) await prisma.quizQuestion.update({ where: { id: existing.id }, data });
    else await prisma.quizQuestion.create({ data: { ...data, programId, moduleId, order: i } });
  }
  await prisma.quizQuestion.deleteMany({ where: { programId, moduleId, order: { gte: questions.length } } });
}

async function upsertModule(prisma: PrismaClient, programId: string, m: ModuleContent, order: number, isMandatory: boolean) {
  const data = {
    title: m.title,
    summary: m.summary,
    order,
    estimatedMinutes: m.estimatedMinutes,
    isMandatory,
    trackKey: m.trackKey ?? null,
  };
  const mod = await prisma.module.upsert({
    where: { programId_key: { programId, key: m.key } },
    create: { programId, key: m.key, ...data },
    update: data,
  });
  for (let i = 0; i < m.lessons.length; i++) {
    const l = m.lessons[i];
    const ld = { title: l.title, kind: dbLessonKind(l.kind), content: json(l), estimatedMinutes: l.estimatedMinutes, order: i };
    const existing = await prisma.lesson.findFirst({ where: { moduleId: mod.id, order: i } });
    if (existing) await prisma.lesson.update({ where: { id: existing.id }, data: ld });
    else await prisma.lesson.create({ data: { ...ld, moduleId: mod.id } });
  }
  await prisma.lesson.deleteMany({ where: { moduleId: mod.id, order: { gte: m.lessons.length } } });
  await upsertQuestions(prisma, programId, mod.id, m.quiz.questions);
  return mod;
}

async function removeStaleModules(prisma: PrismaClient, programId: string, keys: string[]) {
  await prisma.module.deleteMany({ where: { programId, key: { notIn: keys } } });
}

/** Foundations: all authored modules (mandatory + tracks) and the final assessment. */
export async function seedFoundationsContent(prisma: PrismaClient, programId: string) {
  const keys: string[] = [];
  let order = 1;
  for (const m of foundations.modules) {
    await upsertModule(prisma, programId, m, order++, m.isMandatory);
    keys.push(m.key);
  }
  await removeStaleModules(prisma, programId, keys);
  await upsertQuestions(prisma, programId, null, foundations.finalAssessment);
}

/** Config-driven project program (loaded from project-configs/<slug>). */
export async function seedProjectProgram(prisma: PrismaClient, cfg: ProjectConfig) {
  const data = {
    name: cfg.name,
    description: cfg.description,
    passingScore: Math.round(cfg.passingScore),
    navigationProfile: cfg.navigationProfile,
    upAxis: cfg.coordinate.upAxis,
    yawConvention: cfg.coordinate.yawConvention,
    boxDefinition: cfg.coordinate.boxDefinition,
    labelSchema: json({ ...cfg.labelSchema, attributes: cfg.attributes }),
    enabledTracks: json(cfg.enabledTracks),
    certificationRequirements: json({ requiredTaskCodes: [] as string[] }),
    isActive: true,
  };
  const program = await prisma.trainingProgram.upsert({ where: { slug: cfg.slug }, create: { slug: cfg.slug, ...data }, update: data });

  const keys: string[] = [];
  let order = 1;
  for (const m of foundations.modules.filter((m) => m.isMandatory)) {
    await upsertModule(prisma, program.id, m, order++, true);
    keys.push(m.key);
  }
  for (const m of foundations.modules.filter((m) => !m.isMandatory && m.trackKey && cfg.enabledTracks.includes(m.trackKey))) {
    await upsertModule(prisma, program.id, m, order++, true);
    keys.push(m.key);
  }
  // Project-specific modules: only the Tonic content is authored so far; keyed to its slug.
  const projectModules = cfg.slug === "tonic" ? tonicProjectModules : [];
  for (const m of projectModules) {
    await upsertModule(prisma, program.id, m, order++, true);
    keys.push(m.key);
  }
  await removeStaleModules(prisma, program.id, keys);
  await upsertQuestions(prisma, program.id, null, [...foundations.finalAssessment, ...(cfg.slug === "tonic" ? tonicFinalAssessmentExtra : [])]);
  return program;
}
