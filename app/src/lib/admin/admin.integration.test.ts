// @vitest-environment node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dbFile = path.join(process.cwd(), "prisma", "test-admin.db");
process.env.DATABASE_URL = "file:./test-admin.db";

// The routes read the session through getSessionUser; swap it for a controllable actor.
let current: { id: string; role: "TRAINEE" | "REVIEWER" | "ADMIN"; name: string; email: string } | null = null;
vi.mock("@/lib/session", () => ({
  getSessionUser: async () => current,
  requireUser: async () => { if (!current) throw new Error("no session"); return current; },
}));

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let ops: typeof import("./ops");
let admin: { id: string; role: "ADMIN"; name: string; email: string };
let trainee: { id: string; role: "TRAINEE"; name: string; email: string };
let reviewer: { id: string; role: "REVIEWER"; name: string; email: string };

const post = async (name: string, body: unknown) => {
  const { POST } = await import("@/app/api/admin/op/[name]/route");
  return POST(new Request("http://x/api/admin/op/" + name, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ name }) });
};

describe("admin area (temp SQLite)", () => {
  beforeAll(async () => {
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test-admin.db" }, stdio: "pipe" });
    ({ db } = await import("@/lib/db"));
    ops = await import("./ops");
    const scenes = await import("@/lib/synthetic/scenes");
    const seed = await import("@/lib/tasks/seed-tasks");
    const mk = async (email: string, role: "TRAINEE" | "REVIEWER" | "ADMIN") => {
      const u = await db.user.create({ data: { email, name: email.split("@")[0], passwordHash: "x", role } });
      return { id: u.id, role, name: u.name, email };
    };
    admin = (await mk("admin@example.com", "ADMIN")) as typeof admin;
    trainee = (await mk("trainee@example.com", "TRAINEE")) as typeof trainee;
    reviewer = (await mk("reviewer@example.com", "REVIEWER")) as typeof reviewer;
    await db.trainingProgram.create({
      data: { slug: "foundations", name: "Foundations", labelSchema: { classes: ["Vehicle", "Pedestrian", "Cyclist", "Pole"].map((name) => ({ name })) }, enabledTracks: ["cuboid"], certificationRequirements: { requiredTaskCodes: [] } },
    });
    for (const key of scenes.DEMO_SCENE_KEYS) {
      await db.pointCloudAsset.create({ data: { name: key, format: "synthetic", isSynthetic: true, sourcePath: key, cachePath: key, frameCount: key === "demo-sequence" ? 8 : 1, metadata: {}, createdById: admin.id } });
    }
    await seed.seedFoundationTasks(db);
    const f = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "foundations" } });
    await db.enrollment.create({ data: { userId: trainee.id, programId: f.id } });
    await (await import("@/lib/tasks/assignments")).ensureAssignments(trainee.id, f.id);
  }, 180_000);

  afterAll(async () => {
    await db?.$disconnect();
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
  });

  beforeEach(() => { current = admin; });

  it("trainee gets 403 (and anonymous 401) on every admin operation and route", async () => {
    expect(Object.keys(ops.ops).length).toBeGreaterThan(15);
    for (const name of Object.keys(ops.ops)) {
      current = trainee;
      const res = await post(name, {});
      expect(res.status, `${name} as trainee`).toBe(403);
      current = reviewer;
      expect((await post(name, {})).status, `${name} as reviewer`).toBe(403);
      current = null;
      expect((await post(name, {})).status, `${name} anonymous`).toBe(401);
    }
    const csv = await import("@/app/api/admin/trainees/[id]/activity.csv/route");
    current = trainee;
    expect((await csv.GET(new Request("http://x/"), { params: Promise.resolve({ id: trainee.id }) })).status).toBe(403);
    current = null;
    expect((await csv.GET(new Request("http://x/"), { params: Promise.resolve({ id: trainee.id }) })).status).toBe(401);
    // unknown op is 404 for an admin, input is validated
    current = admin;
    expect((await post("nope.nothing", {})).status).toBe(404);
    expect((await post("task.delete", {})).status).toBe(400);
  });

  it("admin creates the tonic program from its project config and toggles a track (tasks publish/unpublish)", async () => {
    const res = await post("program.create", { mode: "config", slug: "tonic" });
    expect(res.status).toBe(200);
    const program = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "tonic" } });
    expect(await db.module.count({ where: { programId: program.id } })).toBeGreaterThan(5);
    const tasks = await db.taskTemplate.findMany({ where: { programId: program.id } });
    expect(tasks.length).toBe(6);
    const tracking = tasks.find((t) => t.trackKey === "tracking")!;
    expect(tracking.isPublished).toBe(true);
    // second import is refused; re-import is idempotent
    expect((await post("program.create", { mode: "config", slug: "tonic" })).status).toBe(409);
    expect((await post("program.reimport", { id: program.id })).status).toBe(200);
    expect(await db.taskTemplate.count({ where: { programId: program.id } })).toBe(6);

    await db.enrollment.create({ data: { userId: trainee.id, programId: program.id } });
    const form = (tracks: string[]) => ({
      id: program.id, name: program.name, description: "", passingScore: 80, navigationProfile: "orbit", upAxis: "Z", yawConvention: "CCW_ABOUT_UP",
      boxDefinition: "CENTER_DIMS_YAW", isActive: true, labelSchema: program.labelSchema, enabledTracks: tracks, requiredTaskCodes: ["TONIC-03"],
    });
    const off = await post("program.update", form(["cuboid", "sensor_fusion"]));
    expect(off.status).toBe(200);
    expect((await db.taskTemplate.findUniqueOrThrow({ where: { id: tracking.id } })).isPublished).toBe(false);
    expect(await db.module.count({ where: { programId: program.id, trackKey: "tracking", isMandatory: true } })).toBe(0);
    expect((await db.taskTemplate.findUniqueOrThrow({ where: { code: "TONIC-03" } })).isRequiredForCertification).toBe(true);
    expect(((await db.trainingProgram.findUniqueOrThrow({ where: { id: program.id } })).certificationRequirements as { requiredTaskCodes: string[] }).requiredTaskCodes).toEqual(["TONIC-03"]);

    const on = await post("program.update", form(["cuboid", "tracking", "sensor_fusion"]));
    expect(on.status).toBe(200);
    expect((await db.taskTemplate.findUniqueOrThrow({ where: { id: tracking.id } })).isPublished).toBe(true);
    expect(await db.module.count({ where: { programId: program.id, trackKey: "tracking", isMandatory: true } })).toBeGreaterThan(0);
    expect(await db.taskAssignment.count({ where: { userId: trainee.id, taskId: tracking.id } })).toBe(1);
    // invalid label schema is rejected
    expect((await post("program.update", { ...form([]), labelSchema: { classes: [{ name: "A" }, { name: "A" }] } })).status).toBe(400);
  }, 120_000);

  it("blank program, module and quiz editing", async () => {
    const res = await post("program.create", { mode: "blank", name: "Custom Program!" });
    const { data } = (await res.json()) as { data: { id: string; slug: string } };
    expect(data.slug).toBe("custom-program");
    const mods = await db.module.findMany({ where: { programId: data.id }, orderBy: { order: "asc" } });
    expect(mods.length).toBeGreaterThan(5);
    const reordered = [mods[1].id, mods[0].id, ...mods.slice(2).map((m) => m.id)];
    expect((await post("module.reorder", { programId: data.id, moduleIds: reordered })).status).toBe(200);
    expect((await db.module.findUniqueOrThrow({ where: { id: mods[1].id } })).order).toBe(1);
    expect((await post("module.reorder", { programId: data.id, moduleIds: [mods[0].id] })).status).toBe(400);
    expect((await post("module.update", { id: mods[0].id, title: "Renamed", summary: "s", estimatedMinutes: 7, isMandatory: false })).status).toBe(200);
    const before = await db.quizQuestion.count({ where: { programId: data.id, moduleId: mods[0].id } });
    const add = await post("question.save", { programId: data.id, moduleId: mods[0].id, kind: "MULTIPLE_CHOICE", prompt: "Q?", options: ["a", "b", "c"], correctAnswer: 2, explanation: "e" });
    expect(add.status).toBe(200);
    expect(await db.quizQuestion.count({ where: { programId: data.id, moduleId: mods[0].id } })).toBe(before + 1);
    expect((await post("question.save", { programId: data.id, moduleId: mods[0].id, kind: "MULTIPLE_CHOICE", prompt: "Q?", options: ["a", "b"], correctAnswer: 5 })).status).toBe(400);
    const qid = ((await add.json()) as { data: { id: string } }).data.id;
    expect((await post("question.delete", { id: qid })).status).toBe(200);
    expect(await db.quizQuestion.count({ where: { programId: data.id, moduleId: mods[0].id } })).toBe(before);
  }, 60_000);

  it("task edit validates config, duplicate + assign creates assignments, delete is guarded", async () => {
    const t = await db.taskTemplate.findUniqueOrThrow({ where: { code: "TASK-03" } });
    const input = (over: object = {}) => ({
      id: t.id, title: "Basic Cuboid (edited)", description: t.description, objective: t.objective, learningOutcome: t.learningOutcome, difficulty: t.difficulty,
      prerequisiteTaskId: t.prerequisiteTaskId, annotationType: t.annotationType, estimatedMinutes: 12, instructions: ["Look", "Box it"], requiredOutput: ["One box"],
      expectedOutput: t.expectedOutput, hints: ["h"], commonMistakes: [], scoringCriteria: t.scoringCriteria, reviewerRubric: [{ key: "k", name: "Fit", description: "", weight: 100 }],
      reviewerErrorTags: [{ key: "x", name: "X", description: "" }], assetId: t.assetId, isPublished: true, isRequiredForCertification: false, trackKey: null, order: t.order,
      config: { sceneKey: "demo-cuboid-basic" }, ...over,
    });
    expect((await post("task.update", input({ config: { inspection: { checkpoints: "nope" } } }))).status).toBe(400);
    expect((await post("task.update", input({ scoringCriteria: { autoMetrics: [] } }))).status).toBe(400);
    expect((await post("task.update", input())).status).toBe(200);
    const saved = await db.taskTemplate.findUniqueOrThrow({ where: { id: t.id } });
    expect(saved.title).toBe("Basic Cuboid (edited)");
    expect(saved.instructions).toBe("1. Look\n2. Box it");
    expect((saved.config as { requiredOutput: string[] }).requiredOutput).toEqual(["One box"]);

    const dup = await post("task.duplicate", { id: t.id });
    const { data: d1 } = (await dup.json()) as { data: { id: string; code: string } };
    expect(d1.code).toBe("TASK-03-COPY-1");
    expect(((await (await post("task.duplicate", { id: t.id })).json()) as { data: { code: string } }).data.code).toBe("TASK-03-COPY-2");
    const copy = await db.taskTemplate.findUniqueOrThrow({ where: { id: d1.id } });
    expect(copy.isPublished).toBe(false);

    // can't assign an unpublished task
    expect((await post("task.assign", { taskId: d1.id, allEnrolled: true })).status).toBe(409);
    expect((await post("task.setPublished", { id: d1.id, published: true })).status).toBe(200);
    // publishing creates assignments for enrolled trainees (ensureAssignments); assigning again is a no-op
    expect(await db.taskAssignment.count({ where: { taskId: d1.id, userId: trainee.id } })).toBe(1);
    const again = await post("task.assign", { taskId: d1.id, allEnrolled: true });
    expect(((await again.json()) as { data: { created: number; alreadyAssigned: number } }).data).toEqual({ created: 0, alreadyAssigned: 1 });

    const other = await db.user.create({ data: { email: "t2@example.com", name: "T2", passwordHash: "x" } });
    const sel = await post("task.assign", { taskId: d1.id, userIds: [other.id, reviewer.id] });
    expect(((await sel.json()) as { data: { created: number } }).data.created).toBe(1); // reviewer is not a trainee
    expect((await db.taskAssignment.findFirstOrThrow({ where: { taskId: d1.id, userId: other.id } })).assignedById).toBe(admin.id);

    expect((await post("assignment.setReviewer", { taskId: d1.id, reviewerId: reviewer.id })).status).toBe(200);
    expect(await db.taskAssignment.count({ where: { taskId: d1.id, reviewerId: reviewer.id } })).toBe(2);
    expect((await post("assignment.setReviewer", { taskId: d1.id, reviewerId: trainee.id })).status).toBe(400);
    expect((await post("assignment.setReviewer", { userId: other.id, reviewerId: null })).status).toBe(200);

    expect((await post("task.delete", { id: d1.id })).status).toBe(409);
    const dup2 = await db.taskTemplate.findUniqueOrThrow({ where: { code: "TASK-03-COPY-2" } });
    expect((await post("task.delete", { id: dup2.id })).status).toBe(200);
  }, 60_000);

  it("reference annotation is zod-validated and summarised", async () => {
    const t = await db.taskTemplate.findUniqueOrThrow({ where: { code: "TASK-03" } });
    expect((await post("task.setReference", { id: t.id, reference: { cuboids: [{ id: "a" }] } })).status).toBe(400);
    const ok = await post("task.setReference", { id: t.id, reference: { cuboids: [{ id: "a", label: "Vehicle", center: [0, 0, 1], dims: [4, 2, 1.5], yaw: 0 }, { id: "b", label: "Vehicle", center: [5, 0, 1], dims: [4, 2, 1.5], yaw: 0 }] } });
    expect(((await ok.json()) as { data: { summary: { byClass: Record<string, number> } } }).data.summary.byClass).toEqual({ Vehicle: 2 });
    // an annotation-document-shaped payload is converted to the reference format
    const doc = await post("task.setReference", { id: t.id, reference: { version: 1, frames: { "0": { cuboids: [{ id: "c", label: "Pole", center: [0, 0, 1], dims: [1, 1, 3], yaw: 0, attributes: {} }] } }, flags: [], answers: {}, checkpoints: {} } });
    expect(doc.status).toBe(200);
    expect(((await db.taskTemplate.findUniqueOrThrow({ where: { id: t.id } })).referenceAnnotation as { cuboids: { label: string }[] }).cuboids[0].label).toBe("Pole");
  });

  it("users: create (password shown once, enrolled), role guard, reset, enroll/unenroll", async () => {
    const res = await post("user.create", { name: "New Person", email: "New@Example.com", role: "TRAINEE" });
    const { data } = (await res.json()) as { data: { id: string; email: string; password: string } };
    expect(data.email).toBe("new@example.com");
    expect(data.password.length).toBeGreaterThanOrEqual(8);
    const bcrypt = (await import("bcryptjs")).default;
    const row = await db.user.findUniqueOrThrow({ where: { id: data.id } });
    expect(await bcrypt.compare(data.password, row.passwordHash)).toBe(true);
    expect(await db.enrollment.count({ where: { userId: data.id } })).toBe(1);
    expect((await post("user.create", { name: "Dup", email: "new@example.com", role: "TRAINEE" })).status).toBe(409);

    expect((await post("user.setRole", { userId: admin.id, role: "TRAINEE" })).status).toBe(409); // last admin
    expect((await post("user.setRole", { userId: data.id, role: "REVIEWER" })).status).toBe(200);
    const reset = await post("user.resetPassword", { userId: data.id, password: "brand-new-pass" });
    expect(reset.status).toBe(200);
    expect(await bcrypt.compare("brand-new-pass", (await db.user.findUniqueOrThrow({ where: { id: data.id } })).passwordHash)).toBe(true);
    const prog = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "foundations" } });
    expect((await post("user.unenroll", { userId: data.id, programId: prog.id })).status).toBe(200);
    expect((await post("user.enroll", { userId: data.id, programId: prog.id })).status).toBe(200);
  }, 60_000);

  it("asset delete is blocked while tasks reference it; CSV export works for reviewer", async () => {
    const used = await db.pointCloudAsset.findFirstOrThrow({ where: { tasks: { some: {} } } });
    expect((await post("asset.delete", { id: used.id })).status).toBe(409);
    const free = await db.pointCloudAsset.create({ data: { name: "tmp", format: "ply", sourcePath: "x", metadata: {}, createdById: admin.id } });
    expect((await post("asset.delete", { id: free.id })).status).toBe(200);

    const { logActivity } = await import("@/lib/activity");
    await logActivity(trainee.id, "LOGIN");
    await logActivity(trainee.id, "MODULE_OPENED", { entityType: "Module", entityId: "m1", metadata: { note: 'has, "comma"' } });
    const csv = await import("@/app/api/admin/trainees/[id]/activity.csv/route");
    current = reviewer;
    const res = await csv.GET(new Request("http://x/?types=LOGIN"), { params: Promise.resolve({ id: trainee.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body.trim().split("\r\n")).toHaveLength(2); // header + LOGIN only
    expect(body).toContain("LOGIN");
    const all = await (await csv.GET(new Request("http://x/"), { params: Promise.resolve({ id: trainee.id }) })).text();
    expect(all).toContain('\""comma');
  });

  it("dashboard loader reflects database state and the program filter", async () => {
    const q = await import("./queries");
    const all = await q.loadDashboard({});
    expect(all.totalTrainees).toBeGreaterThanOrEqual(2);
    const f = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "foundations" } });
    const filtered = await q.loadDashboard({ programId: f.id });
    expect(filtered.totalTrainees).toBeGreaterThanOrEqual(1);
    const list = await q.listTrainees({ role: "TRAINEE", programId: f.id });
    expect(list.every((r) => r.role === "TRAINEE")).toBe(true);
    const detail = await q.getTraineeDetail(trainee.id);
    expect(detail?.assignments.length).toBeGreaterThan(0);
    const tl = await q.getTimeline(trainee.id, { types: ["LOGIN"] });
    expect(tl.every((e) => e.type === "LOGIN")).toBe(true);
  });
});
