import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD } from "./helpers/constants";
import { createTrainee, db, userByEmail } from "./helpers/db";
import { go, login } from "./helpers/ui";

// T12: hands-on Learn widgets (find-object, live cuboid, decision cards), persisted checkpoints.
// Dana is a REVIEWER so module locks do not apply (staff bypass) and her lessons start incomplete.
const DANA = { name: "Dana E2E", email: "dana.e2e@example.com", password: PASSWORD };
const refOf = (scene: string) =>
  (JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "assets", scene, "reference.json"), "utf8")) as { cuboids: { label: string; center: number[]; dims: number[] }[] }).cuboids;

/** Screen position of a data-frame point in the viewer inside `scope` (several viewers can share a page). */
async function project(page: Page, scope: string, x: number, y: number, z?: number) {
  const p = await page.evaluate(([s, px, py, pz]) => {
    const w = window as unknown as { __engines?: { canvas: HTMLElement; projectToScreen(p: number[]): { x: number; y: number } | null; groundLevel: number }[] };
    const e = (w.__engines ?? []).find((v) => v.canvas.closest(s as string));
    return e ? e.projectToScreen([px as number, py as number, (pz as number | undefined) ?? e.groundLevel]) : null;
  }, [scope, x, y, z] as const);
  expect(p, "projectToScreen").not.toBeNull();
  return p!;
}

async function waitScope(page: Page, scope: string) {
  await page.waitForFunction((s) => {
    const w = window as unknown as { __engines?: { canvas: HTMLElement; getCloud(): unknown }[] };
    return (w.__engines ?? []).some((v) => v.canvas.closest(s) && v.getCloud());
  }, scope, { timeout: 120_000 });
  await page.waitForTimeout(800);
  await page.locator(`${scope} canvas`).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
}

const done = (page: Page, key: string) => page.getByTestId(`checkpoint-${key}`);

test.describe.serial("T12 interactive lessons", () => {
  let danaId = "";
  test.beforeAll(async () => {
    createTrainee(DANA);
    const u = await userByEmail(DANA.email);
    danaId = u.id;
    await db.user.update({ where: { id: u.id }, data: { role: "REVIEWER" } });
    // the live-cuboid guided steps are exercised below, so that tour must start from NOT_STARTED
    await db.tourProgress.deleteMany({ where: { userId: u.id, tourKey: "lesson-cuboid" } });
    // m5 lessons 1-3 done so the knowledge-check CTA can show after lesson 4
    const m5 = await db.module.findFirstOrThrow({ where: { key: "m5-difficult" }, include: { lessons: { orderBy: { order: "asc" } } } });
    for (const l of m5.lessons.slice(0, 3)) await db.lessonProgress.create({ data: { userId: u.id, lessonId: l.id, completedAt: new Date() } });
  });

  test("m1 find-object: wrong clicks give a hint, correct clicks tick checkpoints, reload keeps them", async ({ page }) => {
    await login(page, DANA.email, DANA.password);
    await go(page, "/learn/m1-lidar?l=1");
    const scope = "[data-testid=find-object]";
    await waitScope(page, scope);
    const refs = refOf("demo-occlusion");
    const veh = refs.filter((r) => r.label === "Vehicle");
    const near = (label: string) => refs.filter((r) => r.label === label).sort((a, b) => Math.hypot(a.center[0], a.center[1]) - Math.hypot(b.center[0], b.center[1]))[0];
    const where: Record<string, [number, number, number?]> = {
      "find-ped": [near("Pedestrian").center[0], near("Pedestrian").center[1], 0.9],
      "find-dense": [near("Vehicle").center[0], near("Vehicle").center[1], 0.7],
      "find-sparse": [30, 22],
      "find-ground": [-30, 25],
    };
    expect(veh.length).toBeGreaterThan(2);

    const prompt = page.getByTestId("find-prompt");
    const idOf = async () => {
      const t = await prompt.innerText();
      return t.includes("pedestrian") ? "find-ped" : t.includes("densest") ? "find-dense" : t.includes("sparse") ? "find-sparse" : "find-ground";
    };
    // two misses on the first prompt (a spot on the ground nowhere near the answer, or the ground prompt's opposite: an object)
    const first = await idOf();
    const wrongSpot = first === "find-ground" ? [near("Pedestrian").center[0], near("Pedestrian").center[1], 0.9] : [20, -20];
    const w = await project(page, scope, wrongSpot[0], wrongSpot[1], wrongSpot[2]);
    await page.mouse.click(w.x, w.y);
    await expect(page.getByTestId("feedback")).toContainText("Not quite");
    await page.mouse.click(w.x + 1, w.y);
    await expect(page.getByTestId("feedback")).toContainText("Hint:");

    for (let i = 0; i < 4; i++) {
      const id = await idOf();
      const [x, y, z] = where[id];
      const s = await project(page, scope, x, y, z);
      await page.mouse.click(s.x, s.y);
      await expect(done(page, id)).toHaveAttribute("data-done", "true");
    }
    await expect(prompt).toContainText("All found");
    await expect(page.getByTestId("strip-checkpoints")).toContainText("4/6 checkpoints");

    // server-side: row exists without completedAt and holds exactly the four keys
    const lesson = await db.lesson.findFirstOrThrow({ where: { title: "Reading a point cloud", module: { key: "m1-lidar" } } });
    await expect.poll(async () => (await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: danaId, lessonId: lesson.id } } }))?.checkpoints, { timeout: 15_000 })
      .toEqual(expect.arrayContaining(["find-ped", "find-dense", "find-sparse", "find-ground"]));
    expect((await db.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: danaId, lessonId: lesson.id } } })).completedAt).toBeNull();

    await page.reload();
    await expect(page.getByTestId("strip-checkpoints")).toContainText("4/6 checkpoints", { timeout: 60_000 });
    for (const k of ["find-ped", "find-dense", "find-sparse", "find-ground"]) await expect(done(page, k)).toHaveAttribute("data-done", "true");
    await expect(done(page, "rotate")).toHaveAttribute("data-done", "false");
    await expect(page.getByTestId("mark-complete")).toBeDisabled();
  });

  test("m4 cuboid-live: guided steps, drag-create, Q/E, Fit reaches IoU 0.7, all six checkpoints", async ({ page }) => {
    await login(page, DANA.email, DANA.password);
    await go(page, "/learn/m4-cuboids?l=1");
    const scope = "[data-testid=cuboid-live]";
    await waitScope(page, scope);
    const intro = page.getByTestId("tour-intro");
    await expect(intro).toContainText("Draw your first cuboid", { timeout: 30_000 });
    await intro.getByTestId("tour-start").click();
    const step = page.getByTestId("tour-dialog");
    const next = page.getByTestId("tour-next");
    await expect(step).toHaveAttribute("data-step", "create");

    const car = refOf("demo-cuboid-basic").find((c) => c.label === "Vehicle")!;
    const [cx, cy] = car.center;
    const a = await project(page, scope, cx - 2.2, cy - 1.1);
    const b = await project(page, scope, cx + 2.2, cy + 1.1);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    await expect(done(page, "created")).toHaveAttribute("data-done", "true");
    await expect(step).toHaveAttribute("data-done", "true");
    await next.click();

    await expect(step).toHaveAttribute("data-step", "move");
    await page.keyboard.press("ArrowRight");
    await expect(done(page, "moved")).toHaveAttribute("data-done", "true");
    await next.click();

    await expect(step).toHaveAttribute("data-step", "resize");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(done(page, "resized")).toHaveAttribute("data-done", "true");
    await next.click();

    await expect(step).toHaveAttribute("data-step", "rotate");
    for (let i = 0; i < 3; i++) await page.keyboard.press(i % 2 ? "e" : "q");
    await page.keyboard.press("q");
    await expect(done(page, "rotated")).toHaveAttribute("data-done", "true");
    await next.click();

    await expect(step).toHaveAttribute("data-step", "fit");
    await page.getByTestId("lc-fit").click();
    await expect(async () => {
      const iou = Number(await page.getByTestId("fit-iou").innerText());
      expect(iou).toBeGreaterThanOrEqual(0.7);
    }).toPass();
    await expect(done(page, "fit")).toHaveAttribute("data-done", "true");
    await next.click();

    await expect(step).toHaveAttribute("data-step", "label");
    await page.getByTestId("lc-label").selectOption("Vehicle");
    await expect(done(page, "label")).toHaveAttribute("data-done", "true");
    await next.click();

    await expect(step).toHaveAttribute("data-step", "mistakes");
    await page.getByTestId("lc-mistakes").check();
    await expect(page.getByTestId("mistake-legend")).toBeVisible();
    await next.click(); // Finish
    await expect(step).toHaveCount(0);

    await expect(page.getByTestId("strip-checkpoints")).toContainText("6/6 checkpoints");
    const mark = page.getByTestId("mark-complete");
    await expect(mark).toBeEnabled();
    await expect(page.getByTestId("whats-next")).toContainText("Tight, not tiny");
    await mark.click();
    await expect(page.getByText("Lesson complete")).toBeVisible();
  });

  test("m5 decision cards: two wrong, below 80%, retry the wrong ones, pass; reload keeps ticks; mark complete; quiz CTA", async ({ page }) => {
    await login(page, DANA.email, DANA.password);
    await go(page, "/learn/m5-difficult?l=3");
    const cards = page.getByTestId("decision-cards");
    await expect(cards).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("mark-complete")).toBeDisabled();

    for (let i = 0; i < 6; i++) {
      await expect(page.getByTestId("card-title")).toBeVisible();
      // cards 1 and 2 are answered wrongly on purpose
      await cards.locator(`[data-correct="${i < 2 ? "false" : "true"}"]`).first().click();
      await expect(page.getByTestId("card-feedback")).toContainText(i < 2 ? "Not this one" : "Correct");
      await page.getByTestId("card-next").click();
    }
    await expect(page.getByTestId("cards-result")).toContainText("4 of 6 correct (67%)");
    await expect(done(page, "answered")).toHaveAttribute("data-done", "true");
    await expect(done(page, "passed")).toHaveAttribute("data-done", "false");
    await expect(page.getByTestId("mark-complete")).toBeDisabled();

    await page.getByTestId("cards-retry").click();
    for (let i = 0; i < 2; i++) {
      await cards.locator('[data-correct="true"]').first().click();
      await page.getByTestId("card-next").click();
    }
    await expect(page.getByTestId("cards-result")).toContainText("6 of 6 correct (100%)");
    await expect(done(page, "passed")).toHaveAttribute("data-done", "true");

    const lesson = await db.lesson.findFirstOrThrow({ where: { title: "Practice: what would you do?", module: { key: "m5-difficult" } } });
    await expect.poll(async () => (await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: danaId, lessonId: lesson.id } } }))?.checkpoints, { timeout: 15_000 })
      .toEqual(["answered", "passed"]);

    // reload keeps the ticks (state comes from the server) and the lesson can be completed without redoing the cards
    await page.reload();
    await expect(done(page, "answered")).toHaveAttribute("data-done", "true", { timeout: 60_000 });
    await expect(done(page, "passed")).toHaveAttribute("data-done", "true");
    const mark = page.getByTestId("mark-complete");
    await expect(mark).toBeEnabled();
    await expect(page.getByTestId("whats-next")).toContainText("knowledge check");
    await expect(page.getByTestId("quiz-cta")).toHaveCount(0);
    await mark.click();
    await expect(page.getByText("Lesson complete")).toBeVisible();
    await expect(page.getByTestId("quiz-cta")).toContainText("Take the knowledge check");
    await page.getByRole("link", { name: "Take the knowledge check" }).click();
    await expect(page).toHaveURL(/\/learn\/m5-difficult\/quiz/);

    const row = await db.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: danaId, lessonId: lesson.id } } });
    expect(row.completedAt).not.toBeNull();
    expect(row.checkpoints).toEqual(["answered", "passed"]);
  });
});
