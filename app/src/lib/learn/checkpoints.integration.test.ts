// @vitest-environment node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = path.join(process.cwd(), "prisma", "test-checkpoints.db");
process.env.DATABASE_URL = "file:./test-checkpoints.db";

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let svc: typeof import("./service");
let seed: typeof import("./seed-content");
let programId: string;
let userId: string;
let otherId: string;
let lessonId: string;
let keys: string[];

describe("lesson checkpoint persistence (temp SQLite)", () => {
  beforeAll(async () => {
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test-checkpoints.db" }, stdio: "pipe" });
    ({ db } = await import("@/lib/db"));
    seed = await import("./seed-content");
    svc = await import("./service");
    programId = (await db.trainingProgram.create({ data: { slug: "foundations", name: "Test", passingScore: 80, labelSchema: { classes: [] }, enabledTracks: ["cuboid"], certificationRequirements: {} } })).id;
    await seed.seedFoundationsContent(db, programId);
    userId = (await db.user.create({ data: { email: "cp@example.com", name: "CP", passwordHash: "x" } })).id;
    otherId = (await db.user.create({ data: { email: "cp2@example.com", name: "CP2", passwordHash: "x" } })).id;
    for (const u of [userId, otherId]) await db.enrollment.create({ data: { userId: u, programId } });
    // m4 "Draw a cuboid" has the live cuboid widget; unlock modules 1-3 first so m4 is reachable
    const m1 = await db.module.findFirstOrThrow({ where: { programId, key: "m1-lidar" }, include: { lessons: { orderBy: { order: "asc" } } } });
    lessonId = m1.lessons[1].id; // "Reading a point cloud" has find-object checkpoints
    keys = svc.lessonCheckpointKeys(m1.lessons[1].content);
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
  });

  it("reads the authored checkpoint keys of a lesson", () => {
    expect(keys).toEqual(expect.arrayContaining(["rotate", "zoom", "find-ped", "find-ground"]));
  });

  it("ticking a checkpoint creates a LessonProgress row without completedAt", async () => {
    const r = await svc.recordCheckpoint(userId, "TRAINEE", lessonId, "find-ped");
    expect(r).toEqual({ ok: true, checkpoints: ["find-ped"] });
    const row = await db.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId } } });
    expect(row.completedAt).toBeNull();
    expect(row.checkpoints).toEqual(["find-ped"]);
  });

  it("is idempotent, accumulates keys and loads them back (reload keeps ticks)", async () => {
    await svc.recordCheckpoint(userId, "TRAINEE", lessonId, "find-ped");
    await svc.recordCheckpoint(userId, "TRAINEE", lessonId, "rotate");
    expect(await svc.getCheckpoints(userId, lessonId)).toEqual(["find-ped", "rotate"]);
    expect(await db.lessonProgress.count({ where: { userId, lessonId } })).toBe(1);
  });

  it("ticks that arrive together are all kept", async () => {
    const m3 = await db.module.findFirstOrThrow({ where: { programId, key: "m1-lidar" }, include: { lessons: { orderBy: { order: "asc" } } } });
    const l = m3.lessons[1];
    await Promise.all(["find-dense", "find-sparse", "find-ground"].map((k) => svc.recordCheckpoint(otherId, "TRAINEE", l.id, k)));
    expect([...(await svc.getCheckpoints(otherId, l.id))].sort()).toEqual(["find-dense", "find-ground", "find-sparse"]);
    await db.lessonProgress.deleteMany({ where: { userId: otherId } });
  });

  it("is per user", async () => {
    expect(await svc.getCheckpoints(otherId, lessonId)).toEqual([]);
  });

  it("a checkpoint-only row does not count as a completed lesson", async () => {
    const ov = (await svc.getLearnOverview(userId, "TRAINEE"))!;
    const m1 = ov.modules.find((m) => m.key === "m1-lidar")!;
    expect(m1.lessonsDone).toBe(0);
    expect(m1.status).toBe("IN_PROGRESS"); // opened, but nothing completed
  });

  it("rejects unknown lessons, unknown keys and locked modules", async () => {
    expect((await svc.recordCheckpoint(userId, "TRAINEE", "nope", "rotate")).ok).toBe(false);
    expect((await svc.recordCheckpoint(userId, "TRAINEE", lessonId, "not-a-checkpoint")).ok).toBe(false);
    const m2 = await db.module.findFirstOrThrow({ where: { programId, key: "m2-navigation" }, include: { lessons: { orderBy: { order: "asc" } } } });
    const r = await svc.recordCheckpoint(userId, "TRAINEE", m2.lessons[0].id, "rotate");
    expect(r.ok).toBe(false);
    expect(await svc.getCheckpoints(userId, m2.lessons[0].id)).toEqual([]);
  });

  it("completing the lesson fills completedAt on the same row and keeps the checkpoints", async () => {
    const before = await db.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId } } });
    expect((await svc.completeLesson(userId, "TRAINEE", lessonId)).ok).toBe(true);
    expect((await svc.completeLesson(userId, "TRAINEE", lessonId)).ok).toBe(true);
    const after = await db.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId } } });
    expect(after.id).toBe(before.id);
    expect(after.completedAt).not.toBeNull();
    expect(after.checkpoints).toEqual(["find-ped", "rotate"]);
    expect(await db.activityLog.count({ where: { userId, type: "LESSON_COMPLETED", entityId: lessonId } })).toBe(1);
    const m1 = (await svc.getLearnOverview(userId, "TRAINEE"))!.modules.find((m) => m.key === "m1-lidar")!;
    expect(m1.lessonsDone).toBe(1);
  });

  it("re-seeding the content keeps LessonProgress rows (lessons are updated in place)", async () => {
    const before = await db.lessonProgress.findMany({ where: { userId } });
    await seed.seedFoundationsContent(db, programId);
    const after = await db.lessonProgress.findMany({ where: { userId } });
    expect(after).toEqual(before);
    expect((await db.lesson.findUniqueOrThrow({ where: { id: lessonId } })).title).toBe("Reading a point cloud");
  });
});
