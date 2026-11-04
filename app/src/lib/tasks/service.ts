import type { AssignmentStatus, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { annotationDocumentSchema, emptyDocument, parseDocument, toDocCuboid, type AnnotationDocument, type Cuboid } from "@/lib/annotation/types";
import { validateForSubmit, type Issue } from "@/lib/annotation/validate";
import { computeMetrics, type ReferenceData } from "@/lib/annotation/metrics";
import { parseDecisionData } from "@/lib/review/decision-data";
import { buildWorkspaceTask, rulesFromTask, type TaskConfigJson, type WorkspaceTask } from "./runtime";

export type Result<T> = ({ ok: true } & T) | { ok: false; status: number; error: string; issues?: Issue[] };
const isStaff = (r: Role) => r === "REVIEWER" || r === "ADMIN";
export const EDITABLE: AssignmentStatus[] = ["NOT_STARTED", "IN_PROGRESS", "REVISION_REQUIRED"];
export const DRAFT_LOG_INTERVAL_MS = 5 * 60 * 1000;

export interface Actor { id: string; role: Role; name?: string }

/** Load an assignment the actor may see (owner or staff); `write` additionally requires ownership. */
async function loadAssignment(actor: Actor, id: string, write: boolean) {
  const a = await db.taskAssignment.findUnique({
    where: { id },
    include: { task: { include: { program: true, asset: true, prerequisite: true } }, draft: true },
  });
  if (!a) return { error: { ok: false as const, status: 404, error: "Not found" } };
  const owner = a.userId === actor.id;
  if (!owner && !(isStaff(actor.role) && !write)) return { error: { ok: false as const, status: 403, error: "Forbidden" } };
  return { a, owner };
}

export async function isLockedFor(actor: Actor, a: { userId: string; task: { prerequisiteTaskId: string | null } }): Promise<boolean> {
  if (isStaff(actor.role) || !a.task.prerequisiteTaskId) return false;
  const pre = await db.taskAssignment.findUnique({ where: { taskId_userId: { taskId: a.task.prerequisiteTaskId, userId: a.userId } } });
  return pre?.status !== "APPROVED";
}

export interface Feedback { decision: "APPROVE" | "REQUEST_REVISION"; feedback: string; errorTags: string[]; correctionInstructions: string | null; createdAt: string; score: number | null }

export interface WorkspaceData {
  assignmentId: string;
  status: AssignmentStatus;
  readOnly: boolean;
  isOwner: boolean;
  task: WorkspaceTask;
  document: AnnotationDocument;
  feedback: Feedback | null;
  savedAt: string | null;
  tagNames: Record<string, string>;
  nav: { prevId: string | null; nextId: string | null };
}

function initialDoc(initial: unknown): AnnotationDocument {
  const doc = emptyDocument();
  const cubs = (initial as { cuboids?: Parameters<typeof toDocCuboid>[0][] } | null)?.cuboids;
  if (cubs?.length) doc.frames[0] = { cuboids: cubs.map(toDocCuboid) };
  return doc;
}

export async function latestFeedback(assignmentId: string): Promise<Feedback | null> {
  const d = await db.reviewDecision.findFirst({ where: { submission: { assignmentId } }, orderBy: { createdAt: "desc" } });
  if (!d) return null;
  return {
    decision: d.decision, feedback: d.feedback, errorTags: parseDecisionData(d.errorTags).tags, correctionInstructions: d.correctionInstructions,
    createdAt: d.createdAt.toISOString(), score: d.score,
  };
}

export async function getWorkspace(actor: Actor, id: string): Promise<Result<{ data: WorkspaceData }> | { ok: false; status: 423; error: string }> {
  const r = await loadAssignment(actor, id, false);
  if (r.error) return r.error;
  let { a } = r;
  const { owner } = r;
  if (!a.task.isPublished) return { ok: false, status: 404, error: "Not found" };
  if (await isLockedFor(actor, a)) return { ok: false, status: 423, error: "Locked until the prerequisite task is approved." };

  let draft = a.draft;
  // After a revision request: first open copies the last submitted version into the draft.
  if (owner && a.status === "REVISION_REQUIRED") {
    const last = await db.submissionVersion.findFirst({ where: { assignmentId: a.id }, orderBy: { versionNumber: "desc" } });
    if (last && (!draft || draft.updatedAt < last.submittedAt)) {
      draft = await db.annotationDraft.upsert({ where: { assignmentId: a.id }, create: { assignmentId: a.id, data: last.data as Prisma.InputJsonValue }, update: { data: last.data as Prisma.InputJsonValue } });
    }
  }
  let document: AnnotationDocument | null = null;
  if (draft) document = parseDocument(draft.data);
  // Staff viewing a submitted task without a draft: show the latest version.
  if (!document && !owner) {
    const last = await db.submissionVersion.findFirst({ where: { assignmentId: a.id }, orderBy: { versionNumber: "desc" } });
    if (last) document = parseDocument(last.data);
  }
  if (!document) document = initialDoc(a.task.initialAnnotation);

  const task = buildWorkspaceTask(a.task, a.task.program, a.task.asset);
  const cfg = (a.task.config ?? {}) as TaskConfigJson;
  const tagNames = Object.fromEntries((cfg.reviewerErrorTags ?? []).map((t) => [t.key, t.name]));

  // neighbouring tasks (order within program, published) for Prev/Next
  const siblings = await db.taskAssignment.findMany({
    where: { userId: a.userId, task: { programId: a.task.programId, isPublished: true } },
    include: { task: { select: { order: true } } },
  });
  siblings.sort((x, y) => x.task.order - y.task.order);
  const idx = siblings.findIndex((s) => s.id === a.id);
  a = { ...a };
  return {
    ok: true,
    data: {
      assignmentId: a.id, status: a.status, isOwner: owner,
      readOnly: !owner || !EDITABLE.includes(a.status),
      task, document, feedback: await latestFeedback(a.id), savedAt: draft?.updatedAt.toISOString() ?? null, tagNames,
      nav: { prevId: idx > 0 ? siblings[idx - 1].id : null, nextId: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null },
    },
  };
}

/** Log TASK_OPENED unless one was logged for this assignment in the last 30 minutes. */
export async function logTaskOpened(actor: Actor, assignmentId: string) {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const recent = await db.activityLog.findFirst({ where: { userId: actor.id, type: "TASK_OPENED", entityId: assignmentId, createdAt: { gte: since }, metadata: { path: "$.event", equals: "opened" } } });
  if (!recent) await logActivity(actor.id, "TASK_OPENED", { entityType: "TaskAssignment", entityId: assignmentId, metadata: { event: "opened" } });
}

export async function saveDraft(actor: Actor, id: string, raw: unknown): Promise<Result<{ savedAt: string; status: AssignmentStatus }>> {
  const r = await loadAssignment(actor, id, true);
  if (r.error) return r.error;
  const { a } = r;
  if (!EDITABLE.includes(a.status)) return { ok: false, status: 409, error: `Cannot edit a task in status ${a.status}.` };
  if (await isLockedFor(actor, a)) return { ok: false, status: 403, error: "Locked" };
  const parsed = annotationDocumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: "Invalid annotation document" };
  const data = parsed.data as unknown as Prisma.InputJsonValue;
  const draft = await db.annotationDraft.upsert({ where: { assignmentId: id }, create: { assignmentId: id, data }, update: { data } });
  let status = a.status;
  if (a.status === "NOT_STARTED") {
    await db.taskAssignment.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    status = "IN_PROGRESS";
  }
  const since = new Date(Date.now() - DRAFT_LOG_INTERVAL_MS);
  const recent = await db.activityLog.findFirst({ where: { userId: actor.id, type: "DRAFT_SAVED", entityId: id, createdAt: { gte: since } } });
  if (!recent) {
    const doc = parsed.data as unknown as AnnotationDocument;
    const cuboids = Object.values(doc.frames).reduce((n, f) => n + f.cuboids.length, 0);
    await logActivity(actor.id, "DRAFT_SAVED", { entityType: "TaskAssignment", entityId: id, metadata: { cuboids, flags: doc.flags.length, errorsFound: doc.errorsFound?.length ?? 0, pointLabelFrames: doc.pointLabels?.length ?? 0 } });
  }
  return { ok: true, savedAt: draft.updatedAt.toISOString(), status };
}

export async function logEvent(actor: Actor, id: string, ev: { event: "annotation_started" } | { event: "hint_revealed"; index: number }): Promise<Result<object>> {
  const r = await loadAssignment(actor, id, true);
  if (r.error) return r.error;
  if (ev.event === "annotation_started") {
    const had = await db.activityLog.findFirst({ where: { userId: actor.id, type: "ANNOTATION_STARTED", entityId: id } });
    if (!had) await logActivity(actor.id, "ANNOTATION_STARTED", { entityType: "TaskAssignment", entityId: id });
  } else {
    await logActivity(actor.id, "TASK_OPENED", { entityType: "TaskAssignment", entityId: id, metadata: { event: "hint_revealed", hintIndex: ev.index } });
  }
  return { ok: true };
}

export async function submitAssignment(actor: Actor, id: string): Promise<Result<{ versionNumber: number; attemptNumber: number; issues?: Issue[]; warnings: Issue[] }>> {
  const r = await loadAssignment(actor, id, true);
  if (r.error) return r.error;
  const { a } = r;
  if (!EDITABLE.includes(a.status)) return { ok: false, status: 409, error: `Already submitted (status ${a.status}).` };
  if (await isLockedFor(actor, a)) return { ok: false, status: 403, error: "Locked" };
  const wt = buildWorkspaceTask(a.task, a.task.program, a.task.asset);
  const doc = a.draft ? parseDocument(a.draft.data) : initialDoc(a.task.initialAnnotation);
  if (!doc) return { ok: false, status: 400, error: "Saved draft is invalid" };
  const v = validateForSubmit(doc, rulesFromTask(wt));
  if (!v.ok) return { ok: false, status: 422, error: "Submission has validation errors", issues: v.errors };

  const cfg = (a.task.config ?? {}) as TaskConfigJson;
  const ref = (a.task.referenceAnnotation ?? null) as ReferenceData | null;
  const initial = ((a.task.initialAnnotation as { cuboids?: Cuboid[] } | null)?.cuboids ?? []) as unknown as ReferenceData["cuboids"];
  const metrics = computeMetrics(doc, ref, {
    plantedErrors: cfg.plantedErrors, initialCuboids: initial, classIds: cfg.classIds && Object.keys(cfg.classIds).length ? cfg.classIds : undefined,
    checkpointKeys: wt.checkpoints.map((c) => c.key), questionKeys: wt.questions.map((q) => q.key), requiredAttributes: wt.requiredAttributes,
  });
  const priorRevision = await db.reviewDecision.count({ where: { decision: "REQUEST_REVISION", submission: { assignmentId: id } } });

  try {
    const out = await db.$transaction(async (tx) => {
      const fresh = await tx.taskAssignment.findUnique({ where: { id } });
      if (!fresh || !EDITABLE.includes(fresh.status)) throw new Error("STATE");
      const versionNumber = (await tx.submissionVersion.count({ where: { assignmentId: id } })) + 1;
      const attemptNumber = (await tx.submission.count({ where: { assignmentId: id } })) + 1;
      const version = await tx.submissionVersion.create({ data: { assignmentId: id, versionNumber, data: doc as unknown as Prisma.InputJsonValue, metrics: metrics as unknown as Prisma.InputJsonValue } });
      await tx.submission.create({ data: { assignmentId: id, versionId: version.id, attemptNumber, status: "PENDING_REVIEW", userId: actor.id } });
      await tx.taskAssignment.update({ where: { id }, data: { status: "PENDING_REVIEW" } });
      const reviewers = a.reviewerId ? [{ id: a.reviewerId }] : await tx.user.findMany({ where: { role: { in: ["REVIEWER", "ADMIN"] }, passwordHash: { not: { startsWith: "!" } } }, select: { id: true } });
      const trainee = await tx.user.findUnique({ where: { id: actor.id }, select: { name: true } });
      if (reviewers.length) {
        await tx.notification.createMany({
          data: reviewers.map((u) => ({
            userId: u.id, type: "SUBMISSION_PENDING", title: `${a.task.code} submitted for review`,
            body: `${trainee?.name ?? "A trainee"} submitted ${a.task.code} - ${a.task.title} (attempt ${attemptNumber}).`, link: "/review",
          })),
        });
      }
      return { versionNumber, attemptNumber };
    });
    await logActivity(actor.id, priorRevision > 0 ? "REVISION_SUBMITTED" : "TASK_SUBMITTED", {
      entityType: "TaskAssignment", entityId: id, metadata: { code: a.task.code, versionNumber: out.versionNumber, attemptNumber: out.attemptNumber },
    });
    return { ok: true, ...out, warnings: v.warnings };
  } catch (e) {
    if (e instanceof Error && e.message === "STATE") return { ok: false, status: 409, error: "Already submitted." };
    throw e;
  }
}

export interface TaskRow {
  assignmentId: string; code: string; title: string; difficulty: string; annotationType: string; estimatedMinutes: number;
  status: AssignmentStatus; locked: boolean; lockReason?: string; trackKey: string | null; order: number; feedbackSnippet: string | null;
}

export async function listTaskRows(userId: string, programId: string, role: Role): Promise<TaskRow[]> {
  const rows = await db.taskAssignment.findMany({
    where: { userId, task: { programId, isPublished: true } },
    include: { task: { include: { prerequisite: { select: { id: true, code: true } } } } },
  });
  const byTask = new Map(rows.map((r) => [r.taskId, r]));
  const out: TaskRow[] = [];
  for (const r of rows.sort((x, y) => x.task.order - y.task.order)) {
    let feedbackSnippet: string | null = null;
    if (r.status === "REVISION_REQUIRED") {
      const fb = await latestFeedback(r.id);
      if (fb) feedbackSnippet = fb.feedback.length > 120 ? fb.feedback.slice(0, 117) + "..." : fb.feedback || "Revision requested";
    }
    const pre = r.task.prerequisite;
    const locked = !isStaff(role) && Boolean(pre) && byTask.get(pre!.id)?.status !== "APPROVED";
    out.push({
      assignmentId: r.id, code: r.task.code, title: r.task.title, difficulty: r.task.difficulty, annotationType: r.task.annotationType,
      estimatedMinutes: r.task.estimatedMinutes, status: r.status, locked, trackKey: r.task.trackKey, order: r.task.order, feedbackSnippet,
      lockReason: locked ? `Locked until ${pre!.code} is approved.` : undefined,
    });
  }
  return out;
}
