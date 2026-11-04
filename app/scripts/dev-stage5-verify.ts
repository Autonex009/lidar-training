/**
 * Dev utility (Stage 5): headless-Chrome walkthrough of the review loop.
 * Prereqs: `npx tsx scripts/dev-stage5-setup.ts`, dev server on BASE (default http://localhost:3105).
 *   npx tsx scripts/dev-stage5-verify.ts
 */
import fs from "node:fs";
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3105";
const SHOTS = process.env.SHOTS ?? ".verify-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a: unknown[]) => console.log("[verify]", ...a);
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const PASS = "Stage5-demo-pass";

async function login(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  page.on("pageerror", (e) => log("PAGE ERROR", e.message));
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/learn|\/annotate|\/review/);
  return page;
}

const qrow = (p: Page) => p.getByTestId("queue-row-TASK-03").filter({ hasText: "Stage5 Trainee" });
const overlayCount = (page: Page) => page.evaluate(() => (window as unknown as { __engine: { overlays: Map<string, unknown> } }).__engine.overlays.size);
async function waitCloud(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { __engine?: { getCloud(): unknown } }).__engine?.getCloud()), null, { timeout: 60000 });
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const rev = await login(browser, "stage5.reviewer@example.com");

  // ---- reviewer: queue
  await rev.goto(`${BASE}/review`);
  log("header:", flat(await rev.locator("h1").innerText()));
  log("sidebar Review badge:", await rev.getByTestId("nav-badge-Review").innerText());
  const row = qrow(rev);
  log("queue row:", flat(await row.innerText()));
  await rev.screenshot({ path: `${SHOTS}/5-queue.png` });
  await row.getByTestId("assign-me-row").click();
  await rev.waitForTimeout(800);
  log("after Assign to me, reviewer cell:", flat(await qrow(rev).innerText()));

  // ---- reviewer: open submission
  await qrow(rev).getByRole("link", { name: "Review" }).click();
  await rev.waitForSelector('[data-testid="review-workspace"]');
  await waitCloud(rev);
  log("overlays without reference:", await overlayCount(rev));
  log("metrics table:", flat(await rev.getByTestId("metrics-table").innerText()));
  log("history table:", flat(await rev.getByTestId("history-table").innerText()));
  await rev.screenshot({ path: `${SHOTS}/5-review-plain.png` });
  await rev.getByTestId("toggle-reference").check();
  await rev.waitForTimeout(500);
  log("overlays with reference:", await overlayCount(rev));
  await rev.screenshot({ path: `${SHOTS}/5-review-reference.png` });
  await rev.getByTestId("objects-list").getByRole("button").first().click();
  log("object detail:", flat(await rev.getByTestId("object-detail").innerText()));
  log("suggested label (approve mode):", flat(await rev.getByTestId("suggested-label").innerText()), "| score input:", await rev.getByTestId("score-input").inputValue());

  // ---- reviewer: request revision (validation first)
  await rev.getByTestId("mode-revise").click();
  await rev.getByTestId("submit-decision").click();
  log("empty revision error:", await rev.getByTestId("decision-error").innerText());
  await rev.getByRole("button", { name: "Box too large" }).click();
  await rev.getByTestId("feedback-input").fill("Pedestrian box is far too large and the car heading is off.");
  await rev.getByTestId("instructions-input").fill("Tighten the pedestrian box to its points and re-check the car yaw in top view.");
  await rev.screenshot({ path: `${SHOTS}/5-revision-form.png` });
  await rev.getByTestId("submit-decision").click();
  await rev.waitForURL(`${BASE}/review`);
  log("queue after revision (pending filter):", flat(await rev.locator("main").innerText()).slice(0, 160));

  // ---- trainee
  const tr = await login(browser, "stage5.trainee@example.com");
  await tr.goto(`${BASE}/review`);
  log("trainee Review table:", flat(await tr.getByTestId("my-sub-TASK-03-1").innerText()));
  await tr.getByTestId("my-sub-TASK-03-1").getByRole("button").click();
  log("trainee expanded row:", flat(await tr.getByTestId("my-sub-detail").innerText()));
  await tr.screenshot({ path: `${SHOTS}/5-trainee-review.png` });
  log("bell unread:", await tr.getByTestId("notifications-unread").innerText());
  await tr.getByTestId("notifications-button").click();
  await tr.waitForSelector('[data-testid="notification-item"]');
  log("bell items:", (await tr.getByTestId("notification-item").allInnerTexts()).map(flat));
  await tr.screenshot({ path: `${SHOTS}/5-trainee-bell.png` });
  await tr.getByTestId("notification-item").first().click();
  await tr.waitForURL(/\/annotate\//, { waitUntil: "commit", timeout: 20000 }).catch(() => log("URL after click:", tr.url()));
  await tr.waitForSelector('[data-testid="workspace"]');
  log("navigated to:", tr.url().replace(BASE, ""));
  log("workspace status text:", flat(await tr.locator('[data-testid="workspace"] header').innerText()));
  await tr.waitForTimeout(1500);
  const banner = await tr.getByText("Tighten the pedestrian box", { exact: false }).first().innerText().catch(() => "(not visible)");
  log("revision feedback visible in workspace:", flat(banner));
  await tr.screenshot({ path: `${SHOTS}/5-trainee-banner.png` });
  const assignmentId = tr.url().split("/annotate/")[1];
  const resub = await tr.evaluate(async (id) => {
    const r = await fetch(`/api/assignments/${id}/submit`, { method: "POST" });
    return { status: r.status, body: await r.json() };
  }, assignmentId);
  log("resubmit via API:", JSON.stringify(resub));
  await tr.goto(`${BASE}/review`);
  log("trainee bell unread after reading one:", await tr.getByTestId("notifications-unread").innerText().catch(() => "0"));

  // ---- reviewer: approve attempt 2
  await rev.goto(`${BASE}/review`);
  log("queue row attempt 2:", flat(await qrow(rev).innerText()));
  await qrow(rev).getByRole("link", { name: "Review" }).click();
  await rev.waitForSelector('[data-testid="review-workspace"]');
  log("history table:", flat(await rev.getByTestId("history-table").innerText()));
  log("score prefilled:", await rev.getByTestId("score-input").inputValue());
  await rev.getByTestId("score-input").fill("84");
  await rev.getByTestId("feedback-input").fill("Better. Boxes now fit.");
  await rev.getByTestId("submit-decision").click();
  await rev.waitForURL(`${BASE}/review`);

  // ---- trainee: Complete
  await tr.goto(`${BASE}/complete`);
  log("complete row:", flat(await tr.getByTestId("approved-TASK-03").innerText()));
  log("progress:", flat(await tr.getByTestId("progress").innerText()));
  log("certificate section:", flat(await tr.getByTestId("certificate-section").innerText()));
  await tr.screenshot({ path: `${SHOTS}/5-complete.png` });
  await tr.getByTestId("notifications-button").click();
  await tr.waitForSelector('[data-testid="notification-item"]');
  await tr.getByRole("button", { name: "Mark all read" }).click();
  await tr.waitForTimeout(400);
  log("unread badge after Mark all read present:", await tr.getByTestId("notifications-unread").count());
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
