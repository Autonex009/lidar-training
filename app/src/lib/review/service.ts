import { Prisma, type AssignmentStatus, type Role, type SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { parseDocument, type AnnotationDocument } from "@/lib/annotation/types";
import type { ReferenceData, SubmissionMetrics } from "@/lib/annotation/metrics";
import { buildWorkspaceTask, type TaskConfigJson, type WorkspaceTask } from "@/lib/tasks/runtime";
import type { Actor, Result } from "@/lib/tasks/service";
import type { RubricCriterion } from "@/content/tasks/types";
import { evaluateCertification, requiredCodes } from "./certification";
import { packDecisionData, parseDecisionData } from "./decision-data";
import { assignSchema, dayRange, decideSchema, historyFilterSchema, queueFilterSchema, type HistoryFilter, type QueueFilter } from "./schemas";
import { autoScore, metricComponents, suggestedScore, type ScoringCriteriaLike } from "./scoring";

export const isStaff = (r: Role) => r === "REVIEWER" || r === "ADMIN";
const snip = (s: string, n = 100) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

// ---------------------------------------------------------------- queue

export interface QueueRow {
  submissionId: string; assignmentId: string; traineeId: string; traineeName: string; taskCode: string; taskTitle: string; programName: string;
  submittedAt: string; attempt: number; annotationType: string; status: SubmissionStatus; reviewerId: string | null; reviewerName: string | null; priorFeedback: string | null;
}

export async function listQueue(actor: Actor, raw: unknown): Promise<Result<{ rows: QueueRow[]; pending: number }>> {
  if (!isStaff(actor.role)) return { ok: false, status: 403, error: "Forbidden" };
  const f: QueueFilter = queueFilterSchema.parse(raw ?? {});
  const range = dayRange(f.from, f.to);
  const subs = await db.submission.findMany({
    where: {
      ...(f.status !== "ALL" ? { status: f.status } : {}),
      ...(f.traineeId ? { userId: f.traineeId } : {}),
      ...(range ? { submittedAt: range } : {}),
      assignment: {
        ...(f.taskId ? { taskId: f.taskId } : {}),
        ...(f.programId ? { task: { programId: f.programId } } : {}),
        ...(f.mine ? { reviewerId: actor.id } : {}),
      },
    },
    orderBy: { submittedAt: "asc" },
    take: 500,
    include: {
      user: { select: { id: true, name: true } }, decision: true,
      assignment: { include: { task: { include: { program: { select: { name: true } } } }, reviewer: { select: { id: true, name: true } }, submissions: { include: { decision: true } } } },
    },
  });
  const rows: QueueRow[] = subs.map((s) => {
    const others = s.assignment.submissions.filter((o) => o.id !== s.id && o.decision && o.decision.createdAt <= s.submittedAt).sort((a, b) => b.decision!.createdAt.getTime() - a.decision!.createdAt.getTime());
    const fb = s.decision?.feedback || others[0]?.decision?.feedback || null;
    return {
      submissionId: s.id, assignmentId: s.assignmentId, traineeId: s.user.id, traineeName: s.user.name, taskCode: s.assignment.task.code, taskTitle: s.assignment.task.title,
      programName: s.assignment.task.program.name, submittedAt: s.submittedAt.toISOString(), attempt: s.attemptNumber, annotationType: s.assignment.task.annotationType,
      status: s.status, reviewerId: s.assignment.reviewer?.id ?? null, reviewerName: s.assignment.reviewer?.name ?? null, priorFeedback: fb ? snip(fb) : null,
    };
  });
  return { ok: true, rows, pending: await pendingReviewCount() };
}

export const pendingReviewCount = () => db.submission.count({ where: { status: "PENDING_REVIEW" } });

export async function queueFilterOptions() {
  const [tasks, trainees, programs, reviewers] = await Promise.all([
    db.taskTemplate.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
    db.user.findMany({ where: { role: "TRAINEE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.trainingProgram.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: { in: ["REVIEWER", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { tasks, trainees, programs, reviewers };
}

// ---------------------------------------------------------------- detail

export interface VersionRow {
  versionNumber: number; submissionId: string | null; attempt: number | null; submittedAt: string; status: SubmissionStatus | null;
  score: number | null; decision: "APPROVE" | "REQUEST_REVISION" | null; feedback: string | null; reviewerName: string | null;
}

export interface ReviewDetail {
  submission: { id: string; status: SubmissionStatus; attempt: number; submittedAt: string; assignmentId: string; versionNumber: number; isLatest: boolean };
  assignmentStatus: AssignmentStatus;
  trainee: { id: string; name: string; email: string };
  programName: string;
  reviewer: { id: string; name: string } | null;
  task: WorkspaceTask;
  rubric: RubricCriterion[];
  reviewerErrorTags: { key: string; name: string; description: string }[];
  scoringCriteria: ScoringCriteriaLike;
  versions: VersionRow[];
  document: AnnotationDocument;
  metrics: SubmissionMetrics | null;
  decision: { decision: "APPROVE" | "REQUEST_REVISION"; score: number | null; feedback: string; tags: string[]; rubric: Record<string, number>; correctionInstructions: string | null; reviewerName: string; createdAt: string } | null;
  reference: ReferenceData | null;
  plantedErrors: { type: string; cuboidId: string; description?: string }[];
  auto: { score: number | null; suggested: number | null; components: { key: string; value: number | null }[] };
  canDecide: boolean;
}

/** Everything the review page needs for one submission. Staff only; never exposed to trainees. */
export async function getReviewDetail(actor: Actor, submissionId: string, versionNumber?: number): Promise<Result<{ data: ReviewDetail }>> {
  if (!isStaff(actor.role)) return { ok: false, status: 403, error: "Forbidden" };
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    include: { user: { select: { id: true, name: true, email: true } }, version: true, decision: { include: { reviewer: { select: { name: true } } } } },
  });
  if (!sub) return { ok: false, status: 404, error: "Not found" };
  const a = await db.taskAssignment.findUniqueOrThrow({
    where: { id: sub.assignmentId },
    include: { task: { include: { program: true, asset: true } }, reviewer: { select: { id: true, name: true } } },
  });
  const allVersions = await db.submissionVersion.findMany({
    where: { assignmentId: a.id }, orderBy: { versionNumber: "asc" },
    include: { submission: { include: { decision: { include: { reviewer: { select: { name: true } } } } } } },
  });
  const versions: VersionRow[] = allVersions.map((v) => ({
    versionNumber: v.versionNumber, submissionId: v.submission?.id ?? null, attempt: v.submission?.attemptNumber ?? null, submittedAt: v.submittedAt.toISOString(),
    status: v.submission?.status ?? null, score: v.submission?.decision?.score ?? null, decision: v.submission?.decision?.decision ?? null,
    feedback: v.submission?.decision?.feedback ? snip(v.submission.decision.feedback, 140) : null, reviewerName: v.submission?.decision?.reviewer.name ?? null,
  }));
  // Another version may be loaded for viewing (read-only); decisions always target `sub`.
  let viewVersion = sub.version;
  let d = sub.decision;
  if (versionNumber !== undefined && versionNumber !== sub.version.versionNumber) {
    const other = allVersions.find((v) => v.versionNumber === versionNumber);
    if (!other) return { ok: false, status: 404, error: "Version not found" };
    viewVersion = other;
    d = other.submission?.decision ?? null;
  }
  const document = parseDocument(viewVersion.data);
  if (!document) return { ok: false, status: 422, error: "Stored annotation is invalid" };
  const task = buildWorkspaceTask(a.task, a.task.program, a.task.asset);
  const cfg = (a.task.config ?? {}) as TaskConfigJson;
  const criteria = (a.task.scoringCriteria ?? {}) as ScoringCriteriaLike;
  const metrics = (viewVersion.metrics ?? null) as SubmissionMetrics | null;
  const latestVersionNo = allVersions[allVersions.length - 1]?.versionNumber ?? 1;
  const dd = d ? parseDecisionData(d.errorTags) : null;
  const viewingDecided = viewVersion.versionNumber === sub.version.versionNumber;
  return {
    ok: true,
    data: {
      submission: { id: sub.id, status: sub.status, attempt: sub.attemptNumber, submittedAt: sub.submittedAt.toISOString(), assignmentId: a.id, versionNumber: sub.version.versionNumber, isLatest: sub.version.versionNumber === latestVersionNo },
      assignmentStatus: a.status,
      trainee: sub.user, programName: a.task.program.name, reviewer: a.reviewer,
      task, rubric: (Array.isArray(a.task.reviewerRubric) ? a.task.reviewerRubric : []) as unknown as RubricCriterion[],
      reviewerErrorTags: cfg.reviewerErrorTags ?? [], scoringCriteria: criteria,
      versions, document, metrics,
      decision: d && dd ? { decision: d.decision, score: d.score, feedback: d.feedback, tags: dd.tags, rubric: dd.rubric, correctionInstructions: d.correctionInstructions, reviewerName: d.reviewer.name, createdAt: d.createdAt.toISOString() } : null,
      reference: (a.task.referenceAnnotation ?? null) as ReferenceData | null,
      plantedErrors: cfg.plantedErrors ?? [],
      auto: { score: autoScore(metrics, criteria), suggested: suggestedScore(metrics, criteria), components: metricComponents(metrics, criteria) },
      canDecide: viewingDecided && sub.status === "PENDING_REVIEW" && a.status === "PENDING_REVIEW" && sub.userId !== actor.id && !sub.decision,
    },
  };
}

// ---------------------------------------------------------------- decide

export interface DecideOutcome { decisionId: string; status: SubmissionStatus; programCompleted: boolean }

export async function decideSubmission(actor: Actor, submissionId: string, raw: unknown): Promise<Result<DecideOutcome>> {
  if (!isStaff(actor.role)) return { ok: false, status: 403, error: "Forbidden" };
  const parsed = decideSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    include: { decision: true, assignment: { include: { task: { include: { program: true } } } }, user: { select: { name: true } } },
  });
  if (!sub) return { ok: false, status: 404, error: "Not found" };
  if (sub.userId === actor.id) return { ok: false, status: 403, error: "You cannot review your own submission." };
  if (sub.decision) return { ok: false, status: 409, error: "This submission already has a decision." };
  if (sub.status !== "PENDING_REVIEW" || sub.assignment.status !== "PENDING_REVIEW") return { ok: false, status: 409, error: "This submission is not awaiting review." };

  const task = sub.assignment.task;
  const cfg = (task.config ?? {}) as TaskConfigJson;
  const rubricKeys = new Set(((Array.isArray(task.reviewerRubric) ? task.reviewerRubric : []) as unknown as RubricCriterion[]).map((r) => r.key));
  for (const k of Object.keys(input.rubric)) if (!rubricKeys.has(k)) return { ok: false, status: 400, error: `Unknown rubric criterion "${k}"` };
  let tags: string[] = [];
  if (input.decision === "REQUEST_REVISION") {
    const allowed = new Set((cfg.reviewerErrorTags ?? []).map((t) => t.key));
    tags = [...new Set(input.errorTags)];
    for (const t of tags) if (!allowed.has(t)) return { ok: false, status: 400, error: `Unknown error tag "${t}"` };
  }
  const approve = input.decision === "APPROVE";
  const newStatus: SubmissionStatus = approve ? "APPROVED" : "REVISION_REQUIRED";

  let result: { decisionId: string; programCompleted: boolean };
  try {
    result = await db.$transaction(async (tx) => {
      const fresh = await tx.submission.findUnique({ where: { id: submissionId }, include: { decision: true } });
      if (!fresh || fresh.decision || fresh.status !== "PENDING_REVIEW") throw new Error("STATE");
      const decision = await tx.reviewDecision.create({
        data: {
          submissionId, reviewerId: actor.id, decision: input.decision, score: approve ? input.score : null, feedback: input.feedback,
          errorTags: packDecisionData({ tags, rubric: input.rubric }) as unknown as Prisma.InputJsonValue,
          correctionInstructions: input.decision === "REQUEST_REVISION" ? input.correctionInstructions : null,
        },
      });
      await tx.submission.update({ where: { id: submissionId }, data: { status: newStatus } });
      await tx.taskAssignment.update({ where: { id: sub.assignmentId }, data: { status: approve ? "APPROVED" : "REVISION_REQUIRED", reviewerId: actor.id } });
      await tx.notification.create({
        data: approve
          ? { userId: sub.userId, type: "TASK_APPROVED", title: `${task.code} approved`, body: `Score ${input.score}/100.${input.feedback ? ` ${snip(input.feedback, 160)}` : ""}`, link: "/complete" }
          : { userId: sub.userId, type: "REVISION_REQUESTED", title: `${task.code}: revision requested`, body: snip(input.feedback, 200), link: `/annotate/${sub.assignmentId}` },
      });
      let programCompleted = false;
      if (approve) programCompleted = await maybeIssueCertificate(tx, sub.userId, task.programId, task.program.name);
      return { decisionId: decision.id, programCompleted };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "STATE") return { ok: false, status: 409, error: "This submission already has a decision." };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, status: 409, error: "This submission already has a decision." };
    throw e;
  }

  const type = approve ? "TASK_APPROVED" : "REVISION_REQUESTED";
  const meta = { code: task.code, submissionId, assignmentId: sub.assignmentId, attemptNumber: sub.attemptNumber, ...(approve ? { score: input.score } : { errorTags: tags }) };
  await logActivity(sub.userId, type, { entityType: "TaskAssignment", entityId: sub.assignmentId, metadata: { ...meta, reviewerId: actor.id } });
  await logActivity(actor.id, type, { entityType: "TaskAssignment", entityId: sub.assignmentId, metadata: { ...meta, role: "reviewer", traineeId: sub.userId } });
  if (result.programCompleted) await logActivity(sub.userId, "PROGRAM_COMPLETED", { entityType: "TrainingProgram", entityId: task.programId, metadata: { programId: task.programId } });
  return { ok: true, decisionId: result.decisionId, status: newStatus, programCompleted: result.programCompleted };
}

type Tx = Prisma.TransactionClient;

/** After an approval: issue the certificate (once) when every required task is approved. Returns true when newly issued. */
async function maybeIssueCertificate(tx: Tx, userId: string, programId: string, programName: string): Promise<boolean> {
  const program = await tx.trainingProgram.findUnique({ where: { id: programId } });
  if (!program) return false;
  const tasks = await tx.taskTemplate.findMany({ where: { programId }, select: { code: true, isRequiredForCertification: true, isPublished: true } });
  const req = requiredCodes(program.certificationRequirements, tasks);
  const assigns = await tx.taskAssignment.findMany({ where: { userId, task: { programId } }, select: { status: true, task: { select: { code: true } } } });
  const evaln = evaluateCertification(req, Object.fromEntries(assigns.map((x) => [x.task.code, x.status])));
  if (!evaln.complete) return false;
  const existing = await tx.certificate.findUnique({ where: { userId_programId: { userId, programId } } });
  if (existing) return false;
  await tx.certificate.create({ data: { userId, programId } });
  await tx.enrollment.updateMany({ where: { userId, programId }, data: { programCompletedAt: new Date() } });
  await tx.notification.create({ data: { userId, type: "PROGRAM_COMPLETED", title: "Certificate issued", body: `You completed every required task in ${programName}.`, link: "/complete/certificate" } });
  return true;
}

// ---------------------------------------------------------------- assign

export async function assignReviewer(actor: Actor, raw: unknown): Promise<Result<{ reviewerId: string | null }>> {
  if (!isStaff(actor.role)) return { ok: false, status: 403, error: "Forbidden" };
  const p = assignSchema.safeParse(raw);
  if (!p.success) return { ok: false, status: 400, error: "Invalid input" };
  const sub = await db.submission.findUnique({ where: { id: p.data.submissionId }, select: { assignmentId: true } });
  if (!sub) return { ok: false, status: 404, error: "Not found" };
  let reviewerId: string | null = p.data.reviewerId === undefined ? actor.id : p.data.reviewerId;
  if (actor.role !== "ADMIN" && reviewerId !== actor.id) return { ok: false, status: 403, error: "Reviewers can only assign themselves." };
  if (reviewerId && reviewerId !== actor.id) {
    const target = await db.user.findUnique({ where: { id: reviewerId }, select: { role: true } });
    if (!target || !isStaff(target.role)) return { ok: false, status: 400, error: "Reviewer must be a REVIEWER or ADMIN user." };
  }
  reviewerId = reviewerId ?? null;
  await db.taskAssignment.update({ where: { id: sub.assignmentId }, data: { reviewerId } });
  return { ok: true, reviewerId };
}

// ---------------------------------------------------------------- history

export interface HistoryRow {
  decisionId: string; submissionId: string; createdAt: string; decision: "APPROVE" | "REQUEST_REVISION"; score: number | null; feedback: string;
  traineeName: string; taskCode: string; taskTitle: string; attempt: number; reviewerName: string; tags: string[];
}

export async function listHistory(actor: Actor, raw: unknown): Promise<Result<{ rows: HistoryRow[] }>> {
  if (!isStaff(actor.role)) return { ok: false, status: 403, error: "Forbidden" };
  const f: HistoryFilter = historyFilterSchema.parse(raw ?? {});
  const range = dayRange(f.from, f.to);
  const ds = await db.reviewDecision.findMany({
    where: {
      ...(actor.role === "ADMIN" ? (f.reviewerId ? { reviewerId: f.reviewerId } : {}) : { reviewerId: actor.id }),
      ...(f.decision !== "ALL" ? { decision: f.decision } : {}),
      ...(range ? { createdAt: range } : {}),
      submission: { ...(f.traineeId ? { userId: f.traineeId } : {}), ...(f.taskId ? { assignment: { taskId: f.taskId } } : {}) },
    },
    orderBy: { createdAt: "desc" }, take: 500,
    include: { reviewer: { select: { name: true } }, submission: { include: { user: { select: { name: true } }, assignment: { include: { task: { select: { code: true, title: true } } } } } } },
  });
  return {
    ok: true,
    rows: ds.map((d) => ({
      decisionId: d.id, submissionId: d.submissionId, createdAt: d.createdAt.toISOString(), decision: d.decision, score: d.score, feedback: snip(d.feedback, 140),
      traineeName: d.submission.user.name, taskCode: d.submission.assignment.task.code, taskTitle: d.submission.assignment.task.title, attempt: d.submission.attemptNumber,
      reviewerName: d.reviewer.name, tags: parseDecisionData(d.errorTags).tags,
    })),
  };
}

// ---------------------------------------------------------------- trainee views

export interface MySubmissionRow {
  submissionId: string; assignmentId: string; code: string; title: string; attempt: number; submittedAt: string; status: SubmissionStatus;
  reviewerName: string | null; score: number | null; feedback: string | null; tags: string[]; correctionInstructions: string | null;
  canReopen: boolean; history: { attempt: number; status: SubmissionStatus; score: number | null; submittedAt: string }[];
}

/** The trainee's own submissions only (ownership is the `userId` filter). */
export async function listOwnSubmissions(userId: string): Promise<MySubmissionRow[]> {
  const subs = await db.submission.findMany({
    where: { userId }, orderBy: { submittedAt: "desc" },
    include: { decision: { include: { reviewer: { select: { name: true } } } }, assignment: { include: { task: true, reviewer: { select: { name: true } }, submissions: { include: { decision: true } } } } },
  });
  return subs.map((s) => {
    const cfg = (s.assignment.task.config ?? {}) as TaskConfigJson;
    const names = Object.fromEntries((cfg.reviewerErrorTags ?? []).map((t) => [t.key, t.name]));
    const latest = Math.max(...s.assignment.submissions.map((x) => x.attemptNumber));
    return {
      submissionId: s.id, assignmentId: s.assignmentId, code: s.assignment.task.code, title: s.assignment.task.title, attempt: s.attemptNumber, submittedAt: s.submittedAt.toISOString(), status: s.status,
      reviewerName: s.decision?.reviewer.name ?? s.assignment.reviewer?.name ?? null, score: s.decision?.score ?? null, feedback: s.decision?.feedback || null,
      tags: s.decision ? parseDecisionData(s.decision.errorTags).tags.map((t) => names[t] ?? t) : [], correctionInstructions: s.decision?.correctionInstructions ?? null,
      canReopen: s.assignment.status === "REVISION_REQUIRED" && s.attemptNumber === latest && s.status === "REVISION_REQUIRED",
      history: s.assignment.submissions.sort((x, y) => x.attemptNumber - y.attemptNumber).map((x) => ({ attempt: x.attemptNumber, status: x.status, score: x.decision?.score ?? null, submittedAt: x.submittedAt.toISOString() })),
    };
  });
}

export interface CompleteRow { code: string; title: string; annotationType: string; completedAt: string; reviewerName: string; score: number | null; feedback: string; attempts: number }
export interface RemainingRow { code: string; title: string; status: AssignmentStatus; required: boolean }
export interface CompleteSummary {
  programName: string | null;
  approved: CompleteRow[];
  required: { total: number; approved: number; remaining: RemainingRow[] };
  optional: { total: number; approved: number };
  certificate: { issuedAt: string } | null;
  averageScore: number | null;
}

export async function getCompleteSummary(userId: string): Promise<CompleteSummary> {
  const enrollment = await db.enrollment.findFirst({ where: { userId }, orderBy: { enrolledAt: "asc" }, include: { program: true } });
  if (!enrollment) return { programName: null, approved: [], required: { total: 0, approved: 0, remaining: [] }, optional: { total: 0, approved: 0 }, certificate: null, averageScore: null };
  const tasks = await db.taskTemplate.findMany({ where: { programId: enrollment.programId, isPublished: true }, orderBy: { order: "asc" } });
  const assigns = await db.taskAssignment.findMany({
    where: { userId, task: { programId: enrollment.programId, isPublished: true } },
    include: { task: true, submissions: { include: { decision: { include: { reviewer: { select: { name: true } } } } }, orderBy: { attemptNumber: "asc" } } },
  });
  const byCode = new Map(assigns.map((x) => [x.task.code, x]));
  const req = requiredCodes(enrollment.program.certificationRequirements, tasks);
  const reqSet = new Set(req);
  const approved: CompleteRow[] = [];
  for (const t of tasks) {
    const a = byCode.get(t.code);
    if (!a || a.status !== "APPROVED") continue;
    const last = [...a.submissions].reverse().find((s) => s.decision?.decision === "APPROVE");
    approved.push({
      code: t.code, title: t.title, annotationType: t.annotationType, completedAt: (last?.decision?.createdAt ?? a.updatedAt).toISOString(),
      reviewerName: last?.decision?.reviewer.name ?? "-", score: last?.decision?.score ?? null, feedback: last?.decision?.feedback ?? "", attempts: a.submissions.length,
    });
  }
  const cert = await db.certificate.findUnique({ where: { userId_programId: { userId, programId: enrollment.programId } } });
  const ev = evaluateCertification(req, Object.fromEntries(assigns.map((x) => [x.task.code, x.status])));
  const optional = tasks.filter((t) => !reqSet.has(t.code));
  const scores = approved.filter((r) => reqSet.has(r.code) && r.score !== null).map((r) => r.score as number);
  return {
    programName: enrollment.program.name, approved,
    required: { total: req.length, approved: ev.approved, remaining: ev.remaining.map((code) => ({ code, title: tasks.find((t) => t.code === code)?.title ?? code, status: byCode.get(code)?.status ?? "NOT_STARTED", required: true })) },
    optional: { total: optional.length, approved: optional.filter((t) => byCode.get(t.code)?.status === "APPROVED").length },
    certificate: cert ? { issuedAt: cert.issuedAt.toISOString() } : null,
    averageScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
  };
}

export interface CertificateData { traineeName: string; programName: string; issuedAt: string; tasks: { code: string; title: string; score: number | null }[]; averageScore: number | null; certificateId: string }

export async function getCertificate(userId: string): Promise<CertificateData | null> {
  const cert = await db.certificate.findFirst({ where: { userId }, orderBy: { issuedAt: "asc" }, include: { user: { select: { name: true } }, program: true } });
  if (!cert) return null;
  const tasks = await db.taskTemplate.findMany({ where: { programId: cert.programId }, select: { code: true, title: true, isRequiredForCertification: true, isPublished: true, order: true }, orderBy: { order: "asc" } });
  const req = new Set(requiredCodes(cert.program.certificationRequirements, tasks));
  const assigns = await db.taskAssignment.findMany({ where: { userId, task: { programId: cert.programId } }, include: { task: { select: { code: true } }, submissions: { include: { decision: true } } } });
  const scoreOf = (code: string) => {
    const a = assigns.find((x) => x.task.code === code);
    const last = a ? [...a.submissions].reverse().find((s) => s.decision?.decision === "APPROVE") : undefined;
    return last?.decision?.score ?? null;
  };
  const rows = tasks.filter((t) => req.has(t.code)).map((t) => ({ code: t.code, title: t.title, score: scoreOf(t.code) }));
  const sc = rows.map((r) => r.score).filter((x): x is number => x !== null);
  return { traineeName: cert.user.name, programName: cert.program.name, issuedAt: cert.issuedAt.toISOString(), tasks: rows, averageScore: sc.length ? Math.round((sc.reduce((a, b) => a + b, 0) / sc.length) * 10) / 10 : null, certificateId: cert.id };
}

// ---------------------------------------------------------------- notifications

export interface NotificationDto { id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string }

export async function listNotifications(userId: string, limit = 10): Promise<{ items: NotificationDto[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { unread, items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: n.readAt !== null, createdAt: n.createdAt.toISOString() })) };
}

/** Marks the user's own notifications read (ids belonging to other users are ignored). */
export async function markNotificationsRead(userId: string, sel: { all: true } | { ids: string[] }): Promise<number> {
  const r = await db.notification.updateMany({ where: { userId, readAt: null, ...("all" in sel ? {} : { id: { in: sel.ids } }) }, data: { readAt: new Date() } });
  return r.count;
}
