// @vitest-environment node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = path.join(process.cwd(), "prisma", "test-integration.db");
process.env.DATABASE_URL = "file:./test-integration.db";

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let svc: typeof import("./service");
let gate: typeof import("@/lib/gate");
let userId: string;

const wrong = (v: number | boolean) => (typeof v === "boolean" ? !v : v === 0 ? 1 : 0);

async function answers(programId: string, moduleId: string | null, correct: boolean) {
  const qs = await db.quizQuestion.findMany({ where: { programId, moduleId } });
  return Object.fromEntries(qs.map((q) => [q.id, correct ? (q.correctAnswer as number | boolean) : wrong(q.correctAnswer as number | boolean)]));
}

describe("learn flow (temp SQLite)", () => {
  beforeAll(async () => {
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test-integration.db" }, stdio: "pipe" });
    ({ db } = await import("@/lib/db"));
    const seedMod = await import("./seed-content");
    const program = await db.trainingProgram.create({
      data: { slug: "foundations", name: "Test", passingScore: 80, labelSchema: { classes: [] }, enabledTracks: ["cuboid"], certificationRequirements: {} },
    });
    await seedMod.seedFoundationsContent(db, program.id);
    await seedMod.seedFoundationsContent(db, program.id); // idempotent
    userId = (await db.user.create({ data: { email: "t@example.com", name: "T", passwordHash: "x" } })).id;
    svc = await import("./service");
    gate = await import("@/lib/gate");
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
  });

  it("walks enroll -> lessons -> quizzes -> failed final (locked) -> passed final (unlocked)", async () => {
    let ov = (await svc.getLearnOverview(userId, "TRAINEE"))!;
    expect(ov.modules.length).toBeGreaterThan(5);
    expect(ov.final.available).toBe(false);
    expect((await gate.getTraineeGateState(userId)).learnComplete).toBe(false);

    // Sequential lock: second module refuses lesson completion.
    const second = ov.modules[1];
    const secondLesson = await db.lesson.findFirstOrThrow({ where: { moduleId: second.id } });
    expect((await svc.completeLesson(userId, "TRAINEE", secondLesson.id)).ok).toBe(false);
    expect((await svc.submitFinalAssessment(userId, "TRAINEE", {})).ok).toBe(false);

    for (const m of ov.modules.filter((m) => m.isMandatory)) {
      for (const l of await db.lesson.findMany({ where: { moduleId: m.id } })) expect((await svc.completeLesson(userId, "TRAINEE", l.id)).ok).toBe(true);
      const bad = await svc.submitModuleQuiz(userId, "TRAINEE", m.id, await answers(ov.program.id, m.id, false));
      expect(bad.ok && bad.outcome.passed).toBe(false);
      const good = await svc.submitModuleQuiz(userId, "TRAINEE", m.id, await answers(ov.program.id, m.id, true));
      expect(good.ok && good.outcome.passed && good.outcome.moduleCompleted).toBe(true);
    }
    ov = (await svc.getLearnOverview(userId, "TRAINEE"))!;
    expect(ov.allMandatoryDone).toBe(true);
    expect(ov.final.available).toBe(true);
    expect(await db.activityLog.count({ where: { userId, type: "MODULE_COMPLETED" } })).toBe(ov.mandatoryTotal);

    const fail = await svc.submitFinalAssessment(userId, "TRAINEE", await answers(ov.program.id, null, false));
    expect(fail.ok && fail.outcome.passed).toBe(false);
    expect((await gate.getTraineeGateState(userId)).unlocked.annotate).toBe(false);

    const pass = await svc.submitFinalAssessment(userId, "TRAINEE", await answers(ov.program.id, null, true));
    expect(pass.ok && pass.outcome.learnCompleted).toBe(true);
    expect((await gate.getTraineeGateState(userId)).unlocked.annotate).toBe(true);
    expect(await db.notification.count({ where: { userId, type: "LEARN_COMPLETED" } })).toBe(1);
    expect(await db.quizAttempt.count({ where: { userId, isFinal: true } })).toBe(2);
  }, 120_000);

  it("heartbeat starts a new session after 2 minutes", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    await svc.recordHeartbeat(userId, null, t0);
    await svc.recordHeartbeat(userId, null, new Date(t0.getTime() + 30_000));
    await svc.recordHeartbeat(userId, null, new Date(t0.getTime() + 30_000 + 200_000));
    const s = await db.learningSession.findMany({ where: { userId }, orderBy: { startedAt: "asc" } });
    expect(s).toHaveLength(2);
    expect(s[0].seconds).toBe(30);
  });
});
