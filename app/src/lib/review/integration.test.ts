// @vitest-environment node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = path.join(process.cwd(), "prisma", "test-review.db");
process.env.DATABASE_URL = "file:./test-review.db";

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let tasks: typeof import("@/lib/tasks/service");
let rv: typeof import("./service");
type U = { id: string; role: "TRAINEE" | "REVIEWER" | "ADMIN" };
let A: U, B: U, R: U, R2: U, ADM: U;
const aAssign: Record<string, string> = {};

const cuboid = (id: string, label = "Vehicle") => ({ id, label, center: [9, 5, 0.75], dims: [4.5, 1.9, 1.5], yaw: 0.1, attributes: {} });
const doc = (n = 1, label = "Vehicle") => ({ version: 1, frames: { "0": { cuboids: Array.from({ length: n }, (_, i) => cuboid(`c${i}`, label)) } }, flags: [], answers: {}, checkpoints: {} });
const subOf = (assignmentId: string, attempt: number) => db.submission.findFirstOrThrow({ where: { assignmentId, attemptNumber: attempt } });

describe("review workflow (temp SQLite)", () => {
  beforeAll(async () => {
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test-review.db" }, stdio: "pipe" });
    ({ db } = await import("@/lib/db"));
    const scenes = await import("@/lib/synthetic/scenes");
    const seed = await import("@/lib/tasks/seed-tasks");
    const sys = await db.user.create({ data: { email: "sys@example.com", name: "Sys", passwordHash: "x", role: "ADMIN" } });
    await db.trainingProgram.create({
      data: { slug: "foundations", name: "Foundations", labelSchema: { classes: ["Vehicle", "Pedestrian", "Cyclist", "Pole"].map((name) => ({ name })) }, enabledTracks: ["cuboid"], certificationRequirements: {} },
    });
    for (const key of scenes.DEMO_SCENE_KEYS) {
      await db.pointCloudAsset.create({ data: { name: key, format: "synthetic", isSynthetic: true, sourcePath: key, cachePath: key, frameCount: key === "demo-sequence" ? 8 : 1, metadata: {}, createdById: sys.id } });
    }
    const program = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "foundations" } });
    const mk = async (email: string, role: U["role"]): Promise<U> => ({ id: (await db.user.create({ data: { email, name: email.split("@")[0], passwordHash: "x", role } })).id, role });
    A = await mk("alice@example.com", "TRAINEE"); B = await mk("bob@example.com", "TRAINEE");
    R = await mk("rev@example.com", "REVIEWER"); R2 = await mk("rev2@example.com", "REVIEWER"); ADM = await mk("adm@example.com", "ADMIN");
    for (const u of [A, B]) await db.enrollment.create({ data: { userId: u.id, programId: program.id } });
    await seed.seedFoundationTasks(db);
    tasks = await import("@/lib/tasks/service");
    rv = await import("./service");
    for (const row of await db.taskAssignment.findMany({ where: { userId: A.id }, include: { task: true } })) aAssign[row.task.code] = row.id;
    for (const code of ["TASK-01", "TASK-02"]) await db.taskAssignment.update({ where: { id: aAssign[code] }, data: { status: "APPROVED" } });
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
  });

  it("runs the full loop: submit, revision, resubmit, approve, Complete, certificate", async () => {
    const id = aAssign["TASK-03"];
    await tasks.saveDraft(A, id, doc(2));
    expect((await tasks.submitAssignment(A, id)).ok).toBe(true);
    const s1 = await subOf(id, 1);
    const v1Before = JSON.stringify((await db.submissionVersion.findUniqueOrThrow({ where: { id: s1.versionId } })).data);

    // queue + detail (staff)
    const q = await rv.listQueue(R, {});
    expect(q.ok && q.rows.map((r) => r.submissionId)).toContain(s1.id);
    expect(q.ok && q.pending).toBe(1);
    const detail = await rv.getReviewDetail(R, s1.id);
    expect(detail.ok && detail.data.versions).toHaveLength(1);
    expect(detail.ok && detail.data.canDecide).toBe(true);
    expect(detail.ok && detail.data.reference?.cuboids.length).toBe(10);

    // validation
    expect((await rv.decideSubmission(R, s1.id, { decision: "REQUEST_REVISION", feedback: "x", errorTags: [], correctionInstructions: "" })).ok).toBe(false);
    const unknownTag = await rv.decideSubmission(R, s1.id, { decision: "REQUEST_REVISION", feedback: "x", errorTags: ["nope"], correctionInstructions: "y" });
    expect(!unknownTag.ok && unknownTag.status).toBe(400);

    // request revision
    const rev = await rv.decideSubmission(R, s1.id, { decision: "REQUEST_REVISION", feedback: "Tighten boxes", errorTags: ["box_too_large", "missing_object"], correctionInstructions: "Fit each box to its points and add the missing car.", rubric: { box_fit: 50 } });
    expect(rev.ok && rev.status).toBe("REVISION_REQUIRED");
    const asg = await db.taskAssignment.findUniqueOrThrow({ where: { id } });
    expect(asg.status).toBe("REVISION_REQUIRED");
    expect(asg.reviewerId).toBe(R.id);
    const note = await db.notification.findFirstOrThrow({ where: { userId: A.id, type: "REVISION_REQUESTED" } });
    expect(note.link).toBe(`/annotate/${id}`);
    const traineeLog = await db.activityLog.findFirstOrThrow({ where: { userId: A.id, type: "REVISION_REQUESTED" } });
    expect((traineeLog.metadata as { reviewerId: string }).reviewerId).toBe(R.id);
    const reviewerLog = await db.activityLog.findFirstOrThrow({ where: { userId: R.id, type: "REVISION_REQUESTED" } });
    expect((reviewerLog.metadata as { role: string }).role).toBe("reviewer");
    const stored = await db.reviewDecision.findUniqueOrThrow({ where: { submissionId: s1.id } });
    expect(stored.errorTags).toEqual({ tags: ["box_too_large", "missing_object"], rubric: { box_fit: 50 } });

    // trainee sees it
    const fb = await tasks.getWorkspace(A, id);
    expect(fb.ok && fb.data.feedback?.errorTags).toEqual(["box_too_large", "missing_object"]);
    const mine = await rv.listOwnSubmissions(A.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].canReopen).toBe(true);
    expect(mine[0].correctionInstructions).toContain("missing car");

    // resubmit => version 2, attempt 2
    const open = await tasks.getWorkspace(A, id);
    expect(open.ok && open.data.readOnly).toBe(false);
    await tasks.saveDraft(A, id, doc(3));
    const re = await tasks.submitAssignment(A, id);
    expect(re.ok && re.versionNumber).toBe(2);
    expect(re.ok && re.attemptNumber).toBe(2);
    const s2 = await subOf(id, 2);
    expect(await db.taskAssignment.findUniqueOrThrow({ where: { id } }).then((x) => x.status)).toBe("PENDING_REVIEW");
    expect(await db.activityLog.count({ where: { userId: A.id, type: "REVISION_SUBMITTED" } })).toBe(1);

    // version history in detail
    const d2 = await rv.getReviewDetail(R, s2.id);
    expect(d2.ok && d2.data.versions.map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(d2.ok && d2.data.versions[0].decision).toBe("REQUEST_REVISION");

    // approve with score; no certificate yet (other required tasks outstanding)
    const ok = await rv.decideSubmission(R, s2.id, { decision: "APPROVE", score: 88, feedback: "Good", rubric: {} });
    expect(ok.ok && ok.programCompleted).toBe(false);
    expect(await db.taskAssignment.findUniqueOrThrow({ where: { id } }).then((x) => x.status)).toBe("APPROVED");
    expect(await db.notification.findFirstOrThrow({ where: { userId: A.id, type: "TASK_APPROVED" } }).then((n) => n.link)).toBe("/complete");
    expect(await db.certificate.count()).toBe(0);

    // reviewer never changed submitted data
    expect(JSON.stringify((await db.submissionVersion.findUniqueOrThrow({ where: { id: s1.versionId } })).data)).toBe(v1Before);
    expect(await db.submissionVersion.count({ where: { assignmentId: id } })).toBe(2);

    // Complete lists it
    const sum = await rv.getCompleteSummary(A.id);
    const row = sum.approved.find((r) => r.code === "TASK-03");
    expect(row).toMatchObject({ score: 88, attempts: 2, feedback: "Good" });
    expect(row?.reviewerName).toBe("rev");
    expect(sum.certificate).toBeNull();
    expect(sum.required.remaining.map((r) => r.code)).toContain("TASK-04");

    // finish the remaining required tasks: 05/09/10 approved directly, 04 through the real flow
    for (const code of ["TASK-05", "TASK-09", "TASK-10"]) await db.taskAssignment.update({ where: { id: aAssign[code] }, data: { status: "APPROVED" } });
    const id4 = aAssign["TASK-04"];
    const sub4 = await tasks.submitAssignment(A, id4);
    expect(sub4.ok).toBe(true);
    const s4 = await subOf(id4, 1);
    const done = await rv.decideSubmission(ADM, s4.id, { decision: "APPROVE", score: 92, feedback: "", rubric: {} });
    expect(done.ok && done.programCompleted).toBe(true);
    const cert = await rv.getCertificate(A.id);
    expect(cert?.programName).toBe("Foundations");
    expect(cert?.tasks.map((t) => t.code)).toEqual(["TASK-01", "TASK-02", "TASK-03", "TASK-04", "TASK-05", "TASK-09", "TASK-10"]);
    expect(cert?.tasks.find((t) => t.code === "TASK-03")?.score).toBe(88);
    expect((await db.enrollment.findFirstOrThrow({ where: { userId: A.id } })).programCompletedAt).not.toBeNull();
    expect(await db.activityLog.count({ where: { userId: A.id, type: "PROGRAM_COMPLETED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: A.id, type: "PROGRAM_COMPLETED" } })).toBe(1);
    const sum2 = await rv.getCompleteSummary(A.id);
    expect(sum2.certificate).not.toBeNull();
    expect(sum2.required).toMatchObject({ total: 7, approved: 7 });
    expect(sum2.optional.total).toBe(0);

    // history
    const h = await rv.listHistory(R, {});
    expect(h.ok && h.rows).toHaveLength(2); // R's own decisions only
    const ha = await rv.listHistory(ADM, {});
    expect(ha.ok && ha.rows).toHaveLength(3);
    const hf = await rv.listHistory(ADM, { decision: "APPROVE", reviewerId: ADM.id });
    expect(hf.ok && hf.rows).toHaveLength(1);
  });

  it("enforces roles, ownership and one decision per submission", async () => {
    const id = aAssign["TASK-03"];
    const s2 = await subOf(id, 2);
    const approve = { decision: "APPROVE", score: 50, feedback: "", rubric: {} };
    const t = await rv.decideSubmission(A, s2.id, approve);
    expect(!t.ok && t.status).toBe(403);
    const t2 = await rv.assignReviewer(A, { submissionId: s2.id });
    expect(!t2.ok && t2.status).toBe(403);
    // reviewer cannot decide twice
    const twice = await rv.decideSubmission(R, s2.id, approve);
    expect(!twice.ok && twice.status).toBe(409);
    expect(await db.reviewDecision.count({ where: { submissionId: s2.id } })).toBe(1);
    expect((await rv.decideSubmission(R, "missing", approve)).ok).toBe(false);
    // trainee B cannot see A's submission page data, nor A's rows
    const peek = await rv.getReviewDetail(B, s2.id);
    expect(!peek.ok && peek.status).toBe(403);
    expect((await rv.listQueue(B, {})).ok).toBe(false);
    expect((await rv.listHistory(B, {})).ok).toBe(false);
    expect(await rv.listOwnSubmissions(B.id)).toHaveLength(0);
    expect((await rv.getCompleteSummary(B.id)).approved).toHaveLength(0);
    expect(await rv.getCertificate(B.id)).toBeNull();
  });

  it("assignment rules: reviewers self-assign, admins assign anyone staff", async () => {
    const id = aAssign["TASK-03"];
    const s2 = await subOf(id, 2);
    const self = await rv.assignReviewer(R2, { submissionId: s2.id });
    expect(self.ok && self.reviewerId).toBe(R2.id);
    expect((await db.taskAssignment.findUniqueOrThrow({ where: { id } })).reviewerId).toBe(R2.id);
    const other = await rv.assignReviewer(R2, { submissionId: s2.id, reviewerId: R.id });
    expect(!other.ok && other.status).toBe(403);
    expect((await rv.assignReviewer(ADM, { submissionId: s2.id, reviewerId: R.id })).ok).toBe(true);
    const bad = await rv.assignReviewer(ADM, { submissionId: s2.id, reviewerId: B.id });
    expect(!bad.ok && bad.status).toBe(400);
    const mineOnly = await rv.listQueue(R, { status: "ALL", mine: "1" });
    expect(mineOnly.ok && mineOnly.rows.every((r) => r.reviewerId === R.id)).toBe(true);
  });

  it("notifications: list latest, mark own read only", async () => {
    const list = await rv.listNotifications(A.id, 10);
    expect(list.items.length).toBeGreaterThan(2);
    expect(list.unread).toBe(list.items.filter((n) => !n.read).length);
    const bn = await rv.listNotifications(B.id);
    expect(bn.items).toHaveLength(0);
    // B cannot mark A's notifications read
    expect(await rv.markNotificationsRead(B.id, { ids: list.items.map((n) => n.id) })).toBe(0);
    expect(await rv.markNotificationsRead(A.id, { ids: [list.items[0].id] })).toBe(1);
    expect((await rv.listNotifications(A.id)).unread).toBe(list.unread - 1);
    await rv.markNotificationsRead(A.id, { all: true });
    expect((await rv.listNotifications(A.id)).unread).toBe(0);
  });

  it("exposes no way for a reviewer to modify SubmissionVersion.data", async () => {
    // the decision input has no data field and the service never writes submissionVersion
    const { decideSchema } = await import("./schemas");
    const parsed = decideSchema.parse({ decision: "APPROVE", score: 70, data: { hacked: true } });
    expect(parsed).not.toHaveProperty("data");
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/review/service.ts"), "utf8");
    expect(src).not.toMatch(/submissionVersion\.(update|upsert|create|delete)/);
  });
});
