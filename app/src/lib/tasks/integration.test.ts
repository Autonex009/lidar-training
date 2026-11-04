// @vitest-environment node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = path.join(process.cwd(), "prisma", "test-tasks.db");
process.env.DATABASE_URL = "file:./test-tasks.db";

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let svc: typeof import("./service");
let A: { id: string; role: "TRAINEE" }, B: { id: string; role: "TRAINEE" }, R: { id: string; role: "REVIEWER" };
const aAssign: Record<string, string> = {};

const cuboid = (id: string) => ({ id, label: "Vehicle", center: [9, 5, 0.75], dims: [4.5, 1.9, 1.5], yaw: 0.1, attributes: {} });
const doc = (n = 1) => ({ version: 1, frames: { "0": { cuboids: Array.from({ length: n }, (_, i) => cuboid(`c${i}`)) } }, flags: [], answers: {}, checkpoints: {} });

describe("task seed, drafts and submit (temp SQLite)", () => {
  beforeAll(async () => {
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test-tasks.db" }, stdio: "pipe" });
    ({ db } = await import("@/lib/db"));
    const scenes = await import("@/lib/synthetic/scenes");
    const seed = await import("./seed-tasks");
    const sys = await db.user.create({ data: { email: "sys@example.com", name: "Sys", passwordHash: "x", role: "ADMIN" } });
    await db.trainingProgram.create({
      data: { slug: "foundations", name: "Test", labelSchema: { classes: ["Vehicle", "Pedestrian", "Cyclist", "Pole"].map((name) => ({ name })) }, enabledTracks: ["cuboid"], certificationRequirements: {} },
    });
    for (const key of scenes.DEMO_SCENE_KEYS) {
      await db.pointCloudAsset.create({ data: { name: key, format: "synthetic", isSynthetic: true, sourcePath: key, cachePath: key, frameCount: key === "demo-sequence" ? 8 : 1, metadata: {}, createdById: sys.id } });
    }
    const program = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "foundations" } });
    const mk = (email: string, role: "TRAINEE" | "REVIEWER") => db.user.create({ data: { email, name: email, passwordHash: "x", role } });
    A = { id: (await mk("a@example.com", "TRAINEE")).id, role: "TRAINEE" };
    B = { id: (await mk("b@example.com", "TRAINEE")).id, role: "TRAINEE" };
    R = { id: (await mk("r@example.com", "REVIEWER")).id, role: "REVIEWER" };
    for (const u of [A, B]) await db.enrollment.create({ data: { userId: u.id, programId: program.id } });
    await seed.seedFoundationTasks(db);
    await seed.seedFoundationTasks(db); // idempotent
    svc = await import("./service");
    for (const row of await db.taskAssignment.findMany({ where: { userId: A.id }, include: { task: true } })) aAssign[row.task.code] = row.id;
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
  });

  it("seeds 10 tasks, publishes only enabled tracks and assigns published tasks to enrollees", async () => {
    expect(await db.taskTemplate.count()).toBe(10);
    const unpublished = (await db.taskTemplate.findMany({ where: { isPublished: false } })).map((t) => t.code).sort();
    expect(unpublished).toEqual(["TASK-06", "TASK-07", "TASK-08"]);
    expect(await db.taskAssignment.count({ where: { userId: A.id } })).toBe(7);
    const { ensureAssignments } = await import("./assignments");
    const prog = await db.trainingProgram.findFirstOrThrow();
    expect(await ensureAssignments(A.id, prog.id)).toBe(0);
    const t5 = await db.taskTemplate.findUniqueOrThrow({ where: { code: "TASK-05" } });
    expect((t5.referenceAnnotation as { cuboids: unknown[] }).cuboids).toHaveLength(8);
    const t2 = await db.taskTemplate.findUniqueOrThrow({ where: { code: "TASK-02" } });
    expect((t2.initialAnnotation as { cuboids: { label: string }[] }).cuboids.every((c) => c.label === "?")).toBe(true);
  });

  it("locks tasks until the prerequisite is approved", async () => {
    const r = await svc.saveDraft(A, aAssign["TASK-03"], doc());
    expect(r.ok).toBe(false);
    expect(!r.ok && r.status).toBe(403);
    const rows = await svc.listTaskRows(A.id, (await db.trainingProgram.findFirstOrThrow()).id, "TRAINEE");
    expect(rows.find((x) => x.code === "TASK-03")?.locked).toBe(true);
    expect(rows.find((x) => x.code === "TASK-01")?.locked).toBe(false);
    for (const code of ["TASK-01", "TASK-02"]) await db.taskAssignment.update({ where: { id: aAssign[code] }, data: { status: "APPROVED" } });
  });

  it("enforces ownership on read and write", async () => {
    const id = aAssign["TASK-03"];
    expect((await svc.saveDraft(B, id, doc())).ok).toBe(false);
    const rb = await svc.getWorkspace(B, id);
    expect(!rb.ok && rb.status).toBe(403);
    expect((await svc.submitAssignment(B, id)).ok).toBe(false);
    const staff = await svc.getWorkspace(R, id);
    expect(staff.ok && staff.data.readOnly).toBe(true);
    expect((await svc.saveDraft(R, id, doc())).ok).toBe(false);
    const own = await svc.getWorkspace(A, id);
    expect(own.ok && own.data.readOnly).toBe(false);
    // the client payload never carries the reference
    expect(JSON.stringify(own.ok ? own.data : {})).not.toContain("referenceAnnotation");
  });

  it("validates drafts, moves NOT_STARTED to IN_PROGRESS and logs a throttled DRAFT_SAVED", async () => {
    const id = aAssign["TASK-03"];
    const bad = await svc.saveDraft(A, id, { nope: true });
    expect(!bad.ok && bad.status).toBe(400);
    const ok = await svc.saveDraft(A, id, doc(2));
    expect(ok.ok && ok.status).toBe("IN_PROGRESS");
    await svc.saveDraft(A, id, doc(3));
    expect(await db.activityLog.count({ where: { userId: A.id, type: "DRAFT_SAVED", entityId: id } })).toBe(1);
    const again = await svc.getWorkspace(A, id);
    expect(again.ok && Object.values(again.data.document.frames)[0].cuboids).toHaveLength(3);
  });

  it("submits once, notifies reviewers, blocks edits, and supports a revision round", async () => {
    const id = aAssign["TASK-03"];
    await svc.saveDraft(A, id, { ...doc(0), frames: {} });
    const empty = await svc.submitAssignment(A, id);
    expect(!empty.ok && empty.status).toBe(422);
    await svc.saveDraft(A, id, doc(2));
    const s1 = await svc.submitAssignment(A, id);
    expect(s1.ok && s1.versionNumber).toBe(1);
    expect((await db.taskAssignment.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING_REVIEW");
    expect(await db.notification.count({ where: { userId: R.id, type: "SUBMISSION_PENDING" } })).toBe(1);
    expect(await db.activityLog.count({ where: { userId: A.id, type: "TASK_SUBMITTED" } })).toBe(1);
    const twice = await svc.submitAssignment(A, id);
    expect(!twice.ok && twice.status).toBe(409);
    const edit = await svc.saveDraft(A, id, doc(1));
    expect(!edit.ok && edit.status).toBe(409);
    const ro = await svc.getWorkspace(A, id);
    expect(ro.ok && ro.data.readOnly).toBe(true);
    const v = await db.submissionVersion.findFirstOrThrow({ where: { assignmentId: id } });
    expect((v.metrics as { boxes?: { refCount: number } }).boxes?.refCount).toBe(10);

    // reviewer asks for a revision (review UI is a later stage: write the decision directly)
    const sub = await db.submission.findFirstOrThrow({ where: { assignmentId: id } });
    await db.reviewDecision.create({ data: { submissionId: sub.id, reviewerId: R.id, decision: "REQUEST_REVISION", feedback: "Tighten the boxes", errorTags: ["box_too_large"] } });
    await db.taskAssignment.update({ where: { id }, data: { status: "REVISION_REQUIRED" } });
    const rev = await svc.getWorkspace(A, id);
    expect(rev.ok && rev.data.readOnly).toBe(false);
    expect(rev.ok && rev.data.feedback?.feedback).toBe("Tighten the boxes");
    expect(rev.ok && Object.values(rev.data.document.frames)[0].cuboids).toHaveLength(2); // copied from the submitted version
    const s2 = await svc.submitAssignment(A, id);
    expect(s2.ok && s2.versionNumber).toBe(2);
    expect(s2.ok && s2.attemptNumber).toBe(2);
    expect(await db.activityLog.count({ where: { userId: A.id, type: "REVISION_SUBMITTED" } })).toBe(1);
  });

  it("B's progress is untouched by A", async () => {
    const rows = await db.taskAssignment.findMany({ where: { userId: B.id } });
    expect(rows.every((r) => r.status === "NOT_STARTED")).toBe(true);
    expect(await db.annotationDraft.count({ where: { assignment: { userId: B.id } } })).toBe(0);
  });
});
