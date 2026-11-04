/**
 * Dev utility (Stage 4): headless-Chrome walkthrough of the Annotate stage.
 * Prereqs: `npx tsx scripts/dev-stage4-setup.ts`, dev server on BASE (default http://localhost:3100).
 *   npx tsx scripts/dev-stage4-verify.ts
 * Logs what it observes; exits non-zero when a step fails. Screenshots go to $SHOTS (default ./.verify-shots).
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS ?? ".verify-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a: unknown[]) => console.log("[verify]", ...a);

async function screen(page: Page, x: number, y: number, z = 0): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(([px, py, pz]) => {
    const eng = (window as unknown as { __engine: { projectToScreen(p: number[]): { x: number; y: number } | null; groundLevel: number } }).__engine;
    return eng.projectToScreen([px, py, pz ?? eng.groundLevel]);
  }, [x, y, z]);
  if (!p) throw new Error("projection failed");
  return p;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  page.on("pageerror", (e) => log("PAGE ERROR", e.message));
  const posts: { url: string; status: number }[] = [];
  page.on("response", (r) => { if (r.url().includes("/draft") && r.request().method() === "POST") posts.push({ url: r.url(), status: r.status() }); });

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "stage4.trainee@example.com");
  await page.fill('input[name="password"]', "Stage4-demo-pass");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/learn|\/annotate/);
  await page.goto(`${BASE}/annotate`);
  await page.screenshot({ path: `${SHOTS}/list.png` });
  const row = page.getByTestId("task-row-TASK-03");
  log("TASK-03 row:", (await row.innerText()).replace(/\s+/g, " "));
  log("TASK-04 row:", (await page.getByTestId("task-row-TASK-04").innerText()).replace(/\s+/g, " "));
  await row.getByRole("link").click();
  await page.waitForSelector('[data-testid="workspace"]');
  await page.waitForFunction(() => Boolean((window as unknown as { __engine?: { getCloud(): unknown } }).__engine?.getCloud()), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  // top view for a clean drag
  await page.getByRole("button", { name: "Top view" }).click();
  await page.waitForTimeout(300);

  // 1. create by drag around the car at (9,5)
  const a = await screen(page, 7.2, 3.8), b = await screen(page, 10.8, 6.2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForSelector('[data-testid="object-row"]');
  const editor = page.getByTestId("attribute-editor");
  const afterCreate = await editor.innerText();
  log("created cuboid; panel says:", afterCreate.replace(/\s+/g, " "));
  await page.screenshot({ path: `${SHOTS}/created.png` });

  // 2. change label
  await editor.getByLabel("Label").selectOption("Cyclist");
  await page.waitForTimeout(200);
  log("label now:", await editor.getByLabel("Label").inputValue());

  // 3. move 2 m along +x with the Move tool
  const before = (await editor.innerText()).match(/Centre ([^·]+)/)?.[1]?.trim();
  await page.getByRole("button", { name: /^Move/ }).click();
  const c = before!.split(",").map(Number);
  const from = await screen(page, c[0], c[1], c[2]), to = await screen(page, c[0] + 2, c[1], c[2]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = (await page.getByTestId("attribute-editor").innerText()).match(/Centre ([^·]+)/)?.[1]?.trim();
  log(`centre before: ${before} | after move: ${after}`);

  // 4. autosave POST
  const resp = await page.waitForResponse((r) => r.url().includes("/draft") && r.request().method() === "POST", { timeout: 20000 });
  log("autosave POST status:", resp.status());
  await page.waitForFunction(() => /Saved/.test(document.querySelector('[data-testid="save-status"]')?.textContent ?? ""));
  log("status text:", await page.getByTestId("save-status").innerText());

  // 5. reload: draft persists
  await page.reload();
  await page.waitForSelector('[data-testid="workspace"]');
  await page.waitForSelector('[data-testid="object-row"]', { timeout: 20000 });
  await page.getByTestId("object-row").first().click();
  log("after reload, rows:", await page.getByTestId("object-row").count(), "| panel:", (await page.getByTestId("attribute-editor").innerText()).replace(/\s+/g, " "));
  await page.screenshot({ path: `${SHOTS}/reloaded.png` });

  // 6. submit
  await page.getByTestId("submit-button").click();
  await page.waitForSelector('[data-testid="submit-dialog"]');
  log("submit dialog:", (await page.getByTestId("submit-dialog").innerText()).replace(/\s+/g, " "));
  await page.screenshot({ path: `${SHOTS}/submit.png` });
  await page.getByRole("button", { name: "Confirm and submit" }).click();
  await page.waitForTimeout(1500);
  log("after confirm url:", page.url(), "dialog:", (await page.getByTestId("submit-dialog").innerText().catch(() => "closed")).replace(/\s+/g, " "));
  await page.waitForURL(`${BASE}/annotate`, { timeout: 20000 });
  await page.waitForSelector('[data-testid="task-row-TASK-03"]');
  log("TASK-03 row after submit:", (await page.getByTestId("task-row-TASK-03").innerText()).replace(/\s+/g, " "));
  await page.screenshot({ path: `${SHOTS}/list-after.png` });
  log("draft POSTs seen:", JSON.stringify(posts));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
