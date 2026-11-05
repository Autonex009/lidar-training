import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { chromium, type FullConfig } from "@playwright/test";
import { ADMIN, ALL_TOUR_KEYS, REVIEWER, SETUP_TOKEN } from "./helpers/constants";

const root = path.resolve(__dirname, "..");
const sh = (cmd: string) => execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  // Fresh database every run.
  for (const f of ["e2e.db", "e2e.db-journal"]) fs.rmSync(path.join(root, "prisma", f), { force: true });
  sh("npx prisma migrate deploy");
  if (!fs.existsSync(path.join(root, "data", "assets", "demo-cuboid-basic", "reference.json"))) sh("npm run assets:generate");
  sh("npx prisma db seed");

  // First-run admin via the real /setup form, then the reviewer via the admin API.
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/setup", { timeout: 120_000 });
  await page.fill('input[name="setupToken"]', SETUP_TOKEN);
  await page.fill('input[name="name"]', ADMIN.name);
  await page.fill('input[name="email"]', ADMIN.email);
  await page.fill('input[name="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/learn/, { timeout: 120_000 });
  const res = await page.request.post("/api/admin/op/user.create", { data: { name: REVIEWER.name, email: REVIEWER.email, role: "REVIEWER", password: REVIEWER.password } });
  if (!res.ok()) throw new Error(`createUser reviewer failed: ${res.status()} ${await res.text()}`);
  await browser.close();

  // Staff accounts: guided tours are tested in 11-tours.spec.ts, so mark them done here to keep other specs unobstructed.
  const db = new PrismaClient();
  for (const u of await db.user.findMany({ where: { email: { in: [ADMIN.email, REVIEWER.email] } } })) {
    for (const tourKey of ALL_TOUR_KEYS) await db.tourProgress.upsert({ where: { userId_tourKey: { userId: u.id, tourKey } }, create: { userId: u.id, tourKey, status: "COMPLETED", completedAt: new Date() }, update: { status: "COMPLETED" } });
  }
  await db.$disconnect();
}
