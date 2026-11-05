// @vitest-environment node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = path.join(process.cwd(), "prisma", "test-tours.db");
process.env.DATABASE_URL = "file:./test-tours.db";

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let svc: typeof import("./service");
let a: string, b: string;

describe("tour persistence (temp SQLite)", () => {
  beforeAll(async () => {
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test-tours.db" }, stdio: "pipe" });
    ({ db } = await import("@/lib/db"));
    svc = await import("./service");
    a = (await db.user.create({ data: { email: "a@example.com", name: "A", passwordHash: "x" } })).id;
    b = (await db.user.create({ data: { email: "b@example.com", name: "B", passwordHash: "x" } })).id;
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect();
    for (const f of [dbFile, dbFile + "-journal"]) if (fs.existsSync(f)) fs.rmSync(f);
  });

  it("validates keys and payloads", () => {
    expect(svc.tourKeySchema.safeParse("task-cuboid").success).toBe(true);
    expect(svc.tourKeySchema.safeParse("../x").success).toBe(false);
    expect(svc.tourSaveSchema.safeParse({ status: "DONE", lastStepIndex: 0 }).success).toBe(false);
    expect(svc.tourSaveSchema.safeParse({ status: "IN_PROGRESS", lastStepIndex: -1 }).success).toBe(false);
    expect(svc.tourSaveSchema.safeParse({ status: "IN_PROGRESS", lastStepIndex: 2 }).success).toBe(true);
  });

  it("upserts progress, logs transitions once, and only lists the caller's rows", async () => {
    await svc.saveTour(a, "welcome", { status: "IN_PROGRESS", lastStepIndex: 0 });
    await svc.saveTour(a, "welcome", { status: "IN_PROGRESS", lastStepIndex: 2 });
    await svc.saveTour(a, "welcome", { status: "COMPLETED", lastStepIndex: 6 });
    await svc.saveTour(a, "welcome", { status: "COMPLETED", lastStepIndex: 6 });
    await svc.saveTour(b, "navigation-3d", { status: "SKIPPED", lastStepIndex: 1 });

    const mine = await svc.listTours(a);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ tourKey: "welcome", status: "COMPLETED", lastStepIndex: 6 });
    expect(mine[0].completedAt).not.toBeNull();
    expect((await svc.listTours(b)).map((t) => t.tourKey)).toEqual(["navigation-3d"]);

    const types = (await db.activityLog.findMany({ where: { userId: a }, orderBy: { createdAt: "asc" } })).map((l) => l.type);
    expect(types).toEqual(["TOUR_STARTED", "TOUR_COMPLETED"]);
    expect((await db.activityLog.findMany({ where: { userId: b } })).map((l) => l.type)).toEqual(["TOUR_SKIPPED"]);
  });
});
