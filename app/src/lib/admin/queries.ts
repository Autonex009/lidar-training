import type { ActivityType, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { computeProgressPercent } from "@/lib/progress";
import { computeGateState, type GateState } from "@/lib/gate";
import { bucketOf, computeDashboardStats, type DashboardStats, type StatusBucket, type TraineeFacts } from "./stats";
import { buildTimeline, type TimelineEvent } from "./timeline";

export interface FactsFilter { programId?: string; from?: Date; to?: Date }

/** Trainee facts, one row per TRAINEE (selected program's enrollment, else the earliest enrollment). */
export async function loadTraineeFacts(filter: FactsFilter = {}): Promise<TraineeFacts[]> {
  const where: Prisma.UserWhereInput = { role: "TRAINEE" };
  if (filter.from || filter.to) where.createdAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
  if (filter.programId) where.enrollments = { some: { programId: filter.programId } };
  const users = await db.user.findMany({
    where,
    include: {
      enrollments: { orderBy: { enrolledAt: "asc" } },
      moduleProgress: { select: { id: true } },
      quizAttempts: { where: { isFinal: true }, select: { score: true, passed: true, finishedAt: true, programId: true } },
      assignments: { select: { status: true, task: { select: { programId: true } } } },
      certificates: { select: { programId: true } },
    },
  });
  const ids = users.map((u) => u.id);
  const approved = await db.reviewDecision.findMany({
    where: { decision: "APPROVE", score: { not: null }, submission: { userId: { in: ids } } },
    select: { score: true, submission: { select: { userId: true } } },
  });
  const scoresBy = new Map<string, number[]>();
  for (const d of approved) scoresBy.set(d.submission.userId, [...(scoresBy.get(d.submission.userId) ?? []), d.score!]);
  return users.map((u) => {
    const en = filter.programId ? u.enrollments.find((e) => e.programId === filter.programId) : u.enrollments[0];
    const pid = en?.programId ?? null;
    return {
      userId: u.id,
      registeredAt: u.createdAt,
      programId: pid,
      learnCompletedAt: en?.learnCompletedAt ?? null,
      programCompletedAt: en?.programCompletedAt ?? null,
      hasCertificate: u.certificates.some((c) => c.programId === pid),
      modulesOpened: u.moduleProgress.length,
      finalAttempts: u.quizAttempts.filter((a) => !pid || a.programId === pid).map((a) => ({ score: a.score, passed: a.passed, finishedAt: a.finishedAt })),
      assignmentStatuses: u.assignments.filter((a) => !pid || a.task.programId === pid).map((a) => a.status),
      approvedScores: scoresBy.get(u.id) ?? [],
    };
  });
}

export async function loadDashboard(filter: FactsFilter): Promise<DashboardStats> {
  return computeDashboardStats(await loadTraineeFacts(filter));
}

export interface TraineeListRow {
  id: string; name: string; email: string; role: Role; programId: string | null; programName: string | null;
  learnPercent: number | null; approved: number; totalTasks: number; lastActiveAt: Date | null; bucket: StatusBucket | null;
}

export async function listTrainees(f: { q?: string; role?: Role; programId?: string; bucket?: StatusBucket }): Promise<TraineeListRow[]> {
  const where: Prisma.UserWhereInput = {};
  if (f.role) where.role = f.role;
  if (f.programId) where.enrollments = { some: { programId: f.programId } };
  if (f.q) where.OR = [{ name: { contains: f.q } }, { email: { contains: f.q } }];
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { enrollments: { orderBy: { enrolledAt: "asc" }, include: { program: { select: { id: true, name: true } } } } },
  });
  const ids = users.map((u) => u.id);
  const [mandatory, done, assigns, facts] = await Promise.all([
    db.module.groupBy({ by: ["programId"], where: { isMandatory: true }, _count: { _all: true } }),
    db.moduleProgress.findMany({ where: { userId: { in: ids }, completedAt: { not: null }, module: { isMandatory: true } }, select: { userId: true, module: { select: { programId: true } } } }),
    db.taskAssignment.findMany({ where: { userId: { in: ids }, task: { isPublished: true } }, select: { userId: true, status: true, task: { select: { programId: true } } } }),
    loadTraineeFacts({ programId: f.programId }),
  ]);
  const mand = new Map(mandatory.map((m) => [m.programId, m._count._all]));
  const factBy = new Map(facts.map((x) => [x.userId, x]));
  const rows = users.map((u): TraineeListRow => {
    const en = (f.programId ? u.enrollments.find((e) => e.programId === f.programId) : u.enrollments[0]) ?? null;
    const pid = en?.programId ?? null;
    const myAssigns = assigns.filter((a) => a.userId === u.id && (!pid || a.task.programId === pid));
    const doneN = done.filter((d) => d.userId === u.id && d.module.programId === pid).length;
    const total = pid ? mand.get(pid) ?? 0 : 0;
    return {
      id: u.id, name: u.name, email: u.email, role: u.role, programId: pid, programName: en?.program.name ?? null,
      learnPercent: pid && total ? computeProgressPercent(total, doneN, Boolean(en?.learnCompletedAt)) : pid ? 0 : null,
      approved: myAssigns.filter((a) => a.status === "APPROVED").length, totalTasks: myAssigns.length,
      lastActiveAt: u.lastActiveAt, bucket: factBy.has(u.id) ? bucketOf(factBy.get(u.id)!) : null,
    };
  });
  return f.bucket ? rows.filter((r) => r.bucket === f.bucket) : rows;
}

export async function getTraineeDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { enrollments: { include: { program: true }, orderBy: { enrolledAt: "asc" } }, certificates: true },
  });
  if (!user) return null;
  const programIds = user.enrollments.map((e) => e.programId);
  const [modules, modProgress, lessonProgress, attempts, assignments, sessions, programs] = await Promise.all([
    db.module.findMany({ where: { programId: { in: programIds } }, orderBy: [{ programId: "asc" }, { order: "asc" }], include: { _count: { select: { lessons: true } } } }),
    db.moduleProgress.findMany({ where: { userId } }),
    db.lessonProgress.findMany({ where: { userId, completedAt: { not: null } }, select: { lesson: { select: { moduleId: true } } } }),
    db.quizAttempt.findMany({ where: { userId }, orderBy: { finishedAt: "desc" }, include: { module: { select: { title: true } } } }),
    db.taskAssignment.findMany({
      where: { userId }, orderBy: { task: { order: "asc" } },
      include: { task: { select: { code: true, title: true, programId: true } }, reviewer: { select: { name: true } }, submissions: { include: { decision: true }, orderBy: { attemptNumber: "asc" } } },
    }),
    db.learningSession.findMany({ where: { userId } }),
    db.trainingProgram.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const lessonsDone = new Map<string, number>();
  for (const l of lessonProgress) lessonsDone.set(l.lesson.moduleId, (lessonsDone.get(l.lesson.moduleId) ?? 0) + 1);
  const mp = new Map(modProgress.map((m) => [m.moduleId, m]));
  const secondsByModule = new Map<string, number>();
  let totalSeconds = 0;
  for (const s of sessions) {
    totalSeconds += s.seconds;
    if (s.moduleId) secondsByModule.set(s.moduleId, (secondsByModule.get(s.moduleId) ?? 0) + s.seconds);
  }
  const gates: Record<string, GateState> = Object.fromEntries(user.enrollments.map((e) => [e.programId, computeGateState(Boolean(e.learnCompletedAt))]));
  return {
    user, programs, gates, totalSeconds, attempts, assignments,
    modules: modules.map((m) => ({
      id: m.id, programId: m.programId, title: m.title, isMandatory: m.isMandatory, lessons: m._count.lessons,
      lessonsDone: lessonsDone.get(m.id) ?? 0, openedAt: mp.get(m.id)?.openedAt ?? null, completedAt: mp.get(m.id)?.completedAt ?? null,
      quizPassedAt: mp.get(m.id)?.quizPassedAt ?? null, seconds: secondsByModule.get(m.id) ?? 0,
    })),
  };
}

export interface TimelineFilter { types?: ActivityType[]; from?: Date; to?: Date }

export async function getTimeline(userId: string, f: TimelineFilter = {}): Promise<TimelineEvent[]> {
  const where: Prisma.ActivityLogWhereInput = { userId };
  if (f.types?.length) where.type = { in: f.types };
  if (f.from || f.to) where.createdAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const logs = await db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 2000 });
  const aIds = logs.filter((l) => l.entityType === "TaskAssignment" && l.entityId).map((l) => l.entityId!);
  const mIds = logs.filter((l) => l.entityType === "Module" && l.entityId).map((l) => l.entityId!);
  const [as, ms, ps] = await Promise.all([
    db.taskAssignment.findMany({ where: { id: { in: aIds } }, select: { id: true, task: { select: { code: true, title: true } } } }),
    db.module.findMany({ where: { id: { in: mIds } }, select: { id: true, title: true } }),
    db.trainingProgram.findMany({ where: { id: { in: logs.filter((l) => l.entityId).map((l) => l.entityId!) } }, select: { id: true, name: true } }),
  ]);
  const names = new Map<string, string>([...as.map((a) => [a.id, `${a.task.code} ${a.task.title}`] as const), ...ms.map((m) => [m.id, m.title] as const), ...ps.map((p) => [p.id, p.name] as const)]);
  return buildTimeline(logs, names);
}
