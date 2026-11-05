import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getUserEnrollment } from "@/lib/enroll";
import { gradeAnswers, type AnswerValue, type GradeResult } from "./grading";
import { allMandatoryComplete, computeLockedModules } from "./unlock";

export type ModuleStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface ModuleRow {
  id: string;
  key: string;
  title: string;
  summary: string;
  order: number;
  estimatedMinutes: number;
  isMandatory: boolean;
  trackKey: string | null;
  status: ModuleStatus;
  lessonsDone: number;
  lessonsTotal: number;
  quizCount: number;
  quizPassed: boolean;
  bestScore: number | null;
  locked: boolean;
}

export interface LearnOverview {
  program: { id: string; slug: string; name: string; description: string; passingScore: number };
  modules: ModuleRow[];
  mandatoryTotal: number;
  mandatoryDone: number;
  allMandatoryDone: boolean;
  final: { available: boolean; passed: boolean; bestScore: number | null; attempts: number; questionCount: number };
  learnCompletedAt: Date | null;
}

const isStaff = (role: Role) => role === "REVIEWER" || role === "ADMIN";

export async function getLearnOverview(userId: string, role: Role): Promise<LearnOverview | null> {
  const enrollment = await getUserEnrollment(userId);
  if (!enrollment) return null;
  const program = enrollment.program;
  const tracks = Array.isArray(program.enabledTracks) ? (program.enabledTracks as string[]) : [];
  const mods = await db.module.findMany({
    where: { programId: program.id, OR: [{ trackKey: null }, { trackKey: { in: tracks } }, { isMandatory: true }] },
    orderBy: { order: "asc" },
    include: { _count: { select: { lessons: true, questions: true } } },
  });
  const [lessonProgress, moduleProgress, attempts, finalAttempts, finalCount] = await Promise.all([
    db.lessonProgress.findMany({ where: { userId, completedAt: { not: null }, lesson: { module: { programId: program.id } } }, select: { lesson: { select: { moduleId: true } } } }),
    db.moduleProgress.findMany({ where: { userId, module: { programId: program.id } } }),
    db.quizAttempt.findMany({ where: { userId, programId: program.id, isFinal: false }, select: { moduleId: true, score: true } }),
    db.quizAttempt.findMany({ where: { userId, programId: program.id, isFinal: true }, select: { score: true, passed: true } }),
    db.quizQuestion.count({ where: { programId: program.id, moduleId: null } }),
  ]);
  const doneByModule = new Map<string, number>();
  for (const lp of lessonProgress) doneByModule.set(lp.lesson.moduleId, (doneByModule.get(lp.lesson.moduleId) ?? 0) + 1);
  const mpByModule = new Map(moduleProgress.map((m) => [m.moduleId, m]));
  const bestByModule = new Map<string, number>();
  for (const a of attempts) if (a.moduleId) bestByModule.set(a.moduleId, Math.max(bestByModule.get(a.moduleId) ?? -1, a.score));

  const completed = new Set(moduleProgress.filter((m) => m.completedAt).map((m) => m.moduleId));
  const locked = isStaff(role) ? new Set<string>() : computeLockedModules(mods, completed);

  const modules: ModuleRow[] = mods.map((m) => {
    const mp = mpByModule.get(m.id);
    const lessonsDone = doneByModule.get(m.id) ?? 0;
    const status: ModuleStatus = completed.has(m.id) ? "COMPLETED" : mp || lessonsDone > 0 || bestByModule.has(m.id) ? "IN_PROGRESS" : "NOT_STARTED";
    return {
      id: m.id, key: m.key, title: m.title, summary: m.summary, order: m.order, estimatedMinutes: m.estimatedMinutes,
      isMandatory: m.isMandatory, trackKey: m.trackKey, status, lessonsDone, lessonsTotal: m._count.lessons,
      quizCount: m._count.questions, quizPassed: Boolean(mp?.quizPassedAt), bestScore: bestByModule.get(m.id) ?? null, locked: locked.has(m.id),
    };
  });
  const mandatory = modules.filter((m) => m.isMandatory);
  const mandatoryDone = mandatory.filter((m) => m.status === "COMPLETED").length;
  const allDone = allMandatoryComplete(mods, completed);
  return {
    program: { id: program.id, slug: program.slug, name: program.name, description: program.description, passingScore: program.passingScore },
    modules, mandatoryTotal: mandatory.length, mandatoryDone, allMandatoryDone: allDone,
    final: {
      available: (allDone || isStaff(role)) && finalCount > 0,
      passed: finalAttempts.some((a) => a.passed) || Boolean(enrollment.learnCompletedAt),
      bestScore: finalAttempts.length ? Math.max(...finalAttempts.map((a) => a.score)) : null,
      attempts: finalAttempts.length, questionCount: finalCount,
    },
    learnCompletedAt: enrollment.learnCompletedAt,
  };
}

export interface ContinueTarget { href: string; label: string; kind: "lesson" | "quiz" | "assessment" | "annotate" }

/** Where "Continue" should take the learner: first unfinished lesson / quiz of the first open mandatory module, then the assessment, then Annotate. */
export async function getContinueTarget(userId: string, ov: LearnOverview): Promise<ContinueTarget> {
  const open = ov.modules.find((m) => m.isMandatory && !m.locked && m.status !== "COMPLETED");
  if (open) {
    const lessons = await db.lesson.findMany({ where: { moduleId: open.id }, orderBy: { order: "asc" }, select: { id: true, title: true } });
    const done = new Set((await db.lessonProgress.findMany({ where: { userId, completedAt: { not: null }, lessonId: { in: lessons.map((l) => l.id) } }, select: { lessonId: true } })).map((p) => p.lessonId));
    const idx = lessons.findIndex((l) => !done.has(l.id));
    if (idx >= 0) return { href: `/learn/${open.key}?l=${idx}`, label: lessons[idx].title, kind: "lesson" };
    return { href: `/learn/${open.key}/quiz`, label: `${open.title}: knowledge check`, kind: "quiz" };
  }
  if (!ov.final.passed && ov.final.available) return { href: "/learn/assessment", label: "Final assessment", kind: "assessment" };
  return { href: "/annotate", label: "Annotate", kind: "annotate" };
}

/** Total time on Learn (sum of heartbeat sessions), in seconds. */
export async function getLearningSeconds(userId: string): Promise<number> {
  const r = await db.learningSession.aggregate({ where: { userId }, _sum: { seconds: true } });
  return r._sum.seconds ?? 0;
}

/** Module (by key) in the user's program, with a lock check. Returns null when missing; `locked` true when sequentially locked. */
export async function getModuleForUser(userId: string, role: Role, moduleKey: string) {
  const overview = await getLearnOverview(userId, role);
  if (!overview) return null;
  const row = overview.modules.find((m) => m.key === moduleKey);
  if (!row) return null;
  return { overview, row };
}

async function recomputeModuleCompletion(userId: string, moduleId: string): Promise<boolean> {
  const mod = await db.module.findUnique({ where: { id: moduleId }, include: { _count: { select: { lessons: true, questions: true } } } });
  if (!mod) return false;
  const mp = await db.moduleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId } } });
  if (!mp || mp.completedAt) return Boolean(mp?.completedAt);
  const done = await db.lessonProgress.count({ where: { userId, completedAt: { not: null }, lesson: { moduleId } } });
  const lessonsOk = done >= mod._count.lessons;
  const quizOk = mod._count.questions === 0 || Boolean(mp.quizPassedAt);
  if (!lessonsOk || !quizOk) return false;
  await db.moduleProgress.update({ where: { id: mp.id }, data: { completedAt: new Date() } });
  await logActivity(userId, "MODULE_COMPLETED", { entityType: "Module", entityId: moduleId });
  return true;
}

/** Create ModuleProgress and log MODULE_OPENED once. */
export async function openModule(userId: string, moduleId: string) {
  const existing = await db.moduleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId } } });
  if (existing) return existing;
  const created = await db.moduleProgress.upsert({ where: { userId_moduleId: { userId, moduleId } }, create: { userId, moduleId }, update: {} });
  await logActivity(userId, "MODULE_OPENED", { entityType: "Module", entityId: moduleId });
  return created;
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function assertModuleAccess(userId: string, role: Role, moduleId: string): Promise<string | null> {
  const mod = await db.module.findUnique({ where: { id: moduleId } });
  if (!mod) return "Module not found.";
  const overview = await getLearnOverview(userId, role);
  const row = overview?.modules.find((m) => m.id === moduleId);
  if (!row) return "Module not available in your program.";
  if (row.locked) return "This module is locked. Complete the previous module first.";
  return null;
}

export async function completeLesson(userId: string, role: Role, lessonId: string): Promise<ActionResult<{ moduleCompleted: boolean }>> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, error: "Lesson not found." };
  const err = await assertModuleAccess(userId, role, lesson.moduleId);
  if (err) return { ok: false, error: err };
  await openModule(userId, lesson.moduleId);
  const existing = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  if (!existing?.completedAt) {
    // a row may already exist holding only checkpoints: complete it in place
    await db.lessonProgress.upsert({ where: { userId_lessonId: { userId, lessonId } }, create: { userId, lessonId, completedAt: new Date() }, update: { completedAt: new Date() } });
    await logActivity(userId, "LESSON_COMPLETED", { entityType: "Lesson", entityId: lessonId });
  }
  const moduleCompleted = await recomputeModuleCompletion(userId, lesson.moduleId);
  return { ok: true, moduleCompleted };
}

/** Checkpoint keys an author declared in a lesson's interactive blocks. */
export function lessonCheckpointKeys(content: unknown): string[] {
  const blocks = (content as { blocks?: { type?: string; checkpoints?: { key: string }[] }[] } | null)?.blocks ?? [];
  return blocks.flatMap((b) => (b.type === "interactive" ? (b.checkpoints ?? []).map((c) => c.key) : []));
}

const asKeys = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Tick one lesson checkpoint (idempotent). Creates the LessonProgress row without `completedAt` when needed. */
export async function recordCheckpoint(userId: string, role: Role, lessonId: string, key: string): Promise<ActionResult<{ checkpoints: string[] }>> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, error: "Lesson not found." };
  if (!lessonCheckpointKeys(lesson.content).includes(key)) return { ok: false, error: "Unknown checkpoint." };
  const err = await assertModuleAccess(userId, role, lesson.moduleId);
  if (err) return { ok: false, error: err };
  await openModule(userId, lesson.moduleId);
  const where = { userId_lessonId: { userId, lessonId } };
  // read-modify-write inside a transaction so two ticks arriving together cannot overwrite each other
  const next = await db.$transaction(async (tx) => {
    const row = await tx.lessonProgress.findUnique({ where });
    const have = asKeys(row?.checkpoints);
    if (have.includes(key)) return have;
    const merged = [...have, key];
    await tx.lessonProgress.upsert({ where, create: { userId, lessonId, checkpoints: merged }, update: { checkpoints: merged } });
    return merged;
  });
  return { ok: true, checkpoints: next };
}

/** Checkpoints saved so far for a lesson. */
export async function getCheckpoints(userId: string, lessonId: string): Promise<string[]> {
  const row = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } }, select: { checkpoints: true } });
  return asKeys(row?.checkpoints);
}

export interface QuizQuestionView {
  id: string;
  kind: string;
  prompt: string;
  options: string[];
  media: { kind: "svg"; id: string } | { kind: "image"; file: string } | null;
}

export async function getQuestionViews(programId: string, moduleId: string | null): Promise<QuizQuestionView[]> {
  const qs = await db.quizQuestion.findMany({ where: { programId, moduleId }, orderBy: { order: "asc" } });
  return qs.map((q) => ({
    id: q.id, kind: q.kind, prompt: q.prompt,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    media: (q.media as QuizQuestionView["media"]) ?? null,
  }));
}

export interface GradedQuestion {
  questionId: string;
  correct: boolean;
  answer: AnswerValue;
  correctAnswer: number | boolean;
  explanation: string;
}

export interface QuizOutcome {
  score: number;
  passed: boolean;
  passingScore: number;
  correctCount: number;
  total: number;
  questions: GradedQuestion[];
  moduleCompleted?: boolean;
  learnCompleted?: boolean;
}

async function gradeAndStore(
  userId: string, programId: string, moduleId: string | null, isFinal: boolean, passingScore: number, answers: Record<string, AnswerValue>,
) {
  const questions = await db.quizQuestion.findMany({ where: { programId, moduleId }, orderBy: { order: "asc" } });
  if (questions.length === 0) return null;
  const grade: GradeResult = gradeAnswers(questions.map((q) => ({ id: q.id, correctAnswer: q.correctAnswer as number | boolean })), answers, passingScore);
  await db.quizAttempt.create({
    data: { userId, programId, moduleId, isFinal, score: grade.score, passed: grade.passed, answers: answers as Prisma.InputJsonValue },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const outcome: QuizOutcome = {
    score: grade.score, passed: grade.passed, passingScore, correctCount: grade.correctCount, total: grade.total,
    questions: grade.results.map((r) => ({
      questionId: r.questionId, correct: r.correct, answer: r.answer,
      correctAnswer: byId.get(r.questionId)!.correctAnswer as number | boolean, explanation: byId.get(r.questionId)!.explanation,
    })),
  };
  return outcome;
}

export async function submitModuleQuiz(userId: string, role: Role, moduleId: string, answers: Record<string, AnswerValue>): Promise<ActionResult<{ outcome: QuizOutcome }>> {
  const err = await assertModuleAccess(userId, role, moduleId);
  if (err) return { ok: false, error: err };
  const mod = await db.module.findUniqueOrThrow({ where: { id: moduleId }, include: { program: true } });
  const outcome = await gradeAndStore(userId, mod.programId, moduleId, false, mod.program.passingScore, answers);
  if (!outcome) return { ok: false, error: "This module has no quiz." };
  await logActivity(userId, "QUIZ_ATTEMPTED", { entityType: "Module", entityId: moduleId, metadata: { score: outcome.score, passed: outcome.passed } });
  await openModule(userId, moduleId);
  if (outcome.passed) {
    await db.moduleProgress.updateMany({ where: { userId, moduleId, quizPassedAt: null }, data: { quizPassedAt: new Date() } });
    outcome.moduleCompleted = await recomputeModuleCompletion(userId, moduleId);
  }
  return { ok: true, outcome };
}

export async function submitFinalAssessment(userId: string, role: Role, answers: Record<string, AnswerValue>): Promise<ActionResult<{ outcome: QuizOutcome }>> {
  const overview = await getLearnOverview(userId, role);
  if (!overview) return { ok: false, error: "You are not enrolled in a program." };
  if (!overview.final.available) return { ok: false, error: "403: complete all mandatory modules before the final assessment." };
  const outcome = await gradeAndStore(userId, overview.program.id, null, true, overview.program.passingScore, answers);
  if (!outcome) return { ok: false, error: "No final assessment questions." };
  await logActivity(userId, "ASSESSMENT_ATTEMPTED", { entityType: "Program", entityId: overview.program.id, metadata: { score: outcome.score, passed: outcome.passed } });
  if (outcome.passed) {
    const enrollment = await db.enrollment.findUnique({ where: { userId_programId: { userId, programId: overview.program.id } } });
    if (enrollment && !enrollment.learnCompletedAt) {
      await db.enrollment.update({ where: { id: enrollment.id }, data: { learnCompletedAt: new Date() } });
      await logActivity(userId, "LEARN_COMPLETED", { entityType: "Program", entityId: overview.program.id });
      await db.notification.create({
        data: { userId, type: "LEARN_COMPLETED", title: "Annotate, Review and Complete are now unlocked", body: `You passed the final assessment with ${outcome.score}%.`, link: "/annotate" },
      });
      outcome.learnCompleted = true;
    }
  }
  return { ok: true, outcome };
}

/** Learning-time heartbeat: a new session starts when the last ping is more than 2 minutes old. */
export async function recordHeartbeat(userId: string, moduleId: string | null, now = new Date()) {
  const last = await db.learningSession.findFirst({ where: { userId }, orderBy: { lastPingAt: "desc" } });
  if (last && now.getTime() - last.lastPingAt.getTime() <= 120_000) {
    const delta = Math.max(0, Math.round((now.getTime() - last.lastPingAt.getTime()) / 1000));
    await db.learningSession.update({ where: { id: last.id }, data: { lastPingAt: now, seconds: { increment: delta }, moduleId: moduleId ?? last.moduleId } });
  } else {
    await db.learningSession.create({ data: { userId, moduleId, startedAt: now, lastPingAt: now, seconds: 0 } });
  }
}
