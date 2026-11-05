import { expect, test, type Page } from "@playwright/test";
import { CAROL, REVIEWER } from "./helpers/constants";
import { approvePrerequisites, completeMandatoryModules, db, userByEmail } from "./helpers/db";
import { dragGround, go, login, waitCloud } from "./helpers/ui";

// T11: guided onboarding tours. Carol is a fresh trainee (no tour rows), so everything starts from NOT_STARTED.
const dialog = (p: Page) => p.getByTestId("tour-dialog");
const title = (p: Page) => p.getByTestId("tour-title");
const next = (p: Page) => p.getByTestId("tour-next");

async function statusOf(userId: string, tourKey: string) {
  return db.tourProgress.findUnique({ where: { userId_tourKey: { userId, tourKey } } });
}

/** Point inside the viewer canvas, away from the bottom-centre dialog. */
async function viewerPoint(page: Page) {
  const canvas = page.locator('[data-tour="viewer-canvas"] canvas').first();
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const b = (await canvas.boundingBox())!;
  return { x: b.x + b.width * 0.5, y: b.y + b.height * 0.3, b };
}

async function waitViewerReady(page: Page) {
  await expect(page.getByText("Loading point cloud…")).toHaveCount(0, { timeout: 120_000 });
  await page.waitForTimeout(800);
}

test.describe.serial("T11 guided tours", () => {
  test("welcome tour auto-shows on first /learn, Next through it, does not return after reload", async ({ page }) => {
    await go(page, "/register");
    await page.fill('input[name="name"]', CAROL.name);
    await page.fill('input[name="email"]', CAROL.email);
    await page.fill('input[name="password"]', CAROL.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/learn/, { timeout: 120_000 });

    const intro = page.getByTestId("tour-intro");
    await expect(intro).toBeVisible({ timeout: 30_000 });
    await expect(intro).toContainText("Welcome to LiDAR Training");
    await page.getByTestId("tour-start").click();

    await expect(title(page)).toHaveText("Four stages");
    await expect(page.getByTestId("tour-spotlight")).toBeVisible();
    const titles = ["Your learning progress", "Notifications", "Modules and lessons", "The final assessment", "Help menu"];
    for (const t of titles) {
      await next(page).click();
      await expect(title(page)).toHaveText(t);
    }
    await next(page).click();
    await expect(title(page)).toHaveText("Open your first module");
    // real click on the spotlighted module row's link completes the step
    await page.locator('[data-tour="learn-module-first"] a').click();
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();
    await expect(dialog(page)).toHaveCount(0);

    const carol = await userByEmail(CAROL.email);
    await expect.poll(async () => (await statusOf(carol.id, "welcome"))?.status).toBe("COMPLETED");
    const types = (await db.activityLog.findMany({ where: { userId: carol.id } })).map((l) => l.type);
    expect(types).toContain("TOUR_STARTED");
    expect(types).toContain("TOUR_COMPLETED");

    await go(page, "/learn");
    await page.waitForTimeout(2000);
    await expect(page.getByTestId("tour-intro")).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId("tour-resume-pill")).toHaveCount(0);
  });

  test("help menu lists tours with status and restarts one", async ({ page }) => {
    await login(page, CAROL.email, CAROL.password);
    await go(page, "/learn");
    await page.getByTestId("help-button").click();
    await expect(page.getByTestId("help-status-welcome")).toHaveText("Completed");
    await expect(page.getByTestId("help-start-welcome")).toHaveText("Restart");
    await page.getByTestId("help-start-welcome").click();
    await expect(page.getByTestId("tour-intro")).toBeVisible();
    await page.getByTestId("tour-start").click();
    await expect(title(page)).toHaveText("Four stages");
    await page.getByTestId("tour-close").click();
    await expect(page.getByTestId("tour-skip-prompt")).toBeVisible();
    await page.getByTestId("tour-skip-confirm").click();
    await expect(dialog(page)).toHaveCount(0);
    await page.getByTestId("help-button").click();
    await expect(page.getByTestId("help-status-welcome")).toHaveText("Skipped");
  });

  test("navigation tour: real mouse and keyboard actions tick each step", async ({ page }) => {
    const carol = await userByEmail(CAROL.email);
    completeMandatoryModules(carol.id);
    await db.enrollment.updateMany({ where: { userId: carol.id }, data: { learnCompletedAt: new Date() } });
    await approvePrerequisites(carol.id);

    // find the first lesson with a nav widget
    const lessons = await db.lesson.findMany({ include: { module: true }, orderBy: [{ module: { order: "asc" } }, { order: "asc" }] });
    const all = lessons.filter((l) => l.module.programId === lessons[0].module.programId);
    const target = all.find((l) => JSON.stringify(l.content).includes('"widget":"nav"'))!;
    const idx = all.filter((l) => l.moduleId === target.moduleId).findIndex((l) => l.id === target.id);

    await login(page, CAROL.email, CAROL.password);
    await go(page, `/learn/${target.module.key}?l=${idx}`);
    const intro = page.getByTestId("tour-intro");
    await expect(intro).toBeVisible({ timeout: 30_000 });
    await expect(intro).toContainText("Learn 3D scene navigation");
    await expect(intro.getByTestId("tour-start")).toContainText("Start tutorial · 2 mins");
    await intro.getByTestId("tour-start").click();
    await waitViewerReady(page);

    await expect(title(page)).toHaveText("Select an input device");
    await expect(next(page)).toBeDisabled();
    await page.getByTestId("tour-choice-mouse").click();
    await expect(page.getByTestId("tour-check")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("navInputDevice"))).toBe("mouse");
    await next(page).click();

    // rotate: left drag
    await expect(title(page)).toHaveText("Rotate the view");
    await expect(next(page)).toBeDisabled();
    let p = await viewerPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 120, p.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();

    // zoom: wheel
    await expect(title(page)).toHaveText("Zoom in and out");
    p = await viewerPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -240);
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();

    // move: every one of W A S D is needed
    await expect(title(page)).toHaveText("Move with the keyboard");
    p = await viewerPoint(page);
    await page.mouse.move(p.x, p.y);
    for (const k of ["w", "a", "s"]) { await page.keyboard.down(k); await page.waitForTimeout(120); await page.keyboard.up(k); }
    await expect(next(page)).toBeDisabled(); // D still missing
    await page.keyboard.down("d"); await page.waitForTimeout(120); await page.keyboard.up("d");
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();

    // elevate: Q and E
    await expect(title(page)).toHaveText("Move up and down");
    await page.mouse.move(p.x, p.y);
    for (const k of ["q", "e"]) { await page.keyboard.down(k); await page.waitForTimeout(120); await page.keyboard.up(k); }
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();

    // pan: right drag
    await expect(title(page)).toHaveText("Pan the scene");
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(p.x - 80, p.y + 30, { steps: 6 });
    await page.mouse.up({ button: "right" });
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();

    // target: Ctrl + click
    await expect(title(page)).toHaveText("Set the camera target");
    await page.mouse.move(p.x, p.y + 20);
    await page.keyboard.down("Control");
    await page.mouse.move(p.x + 5, p.y + 25, { steps: 3 });
    await page.mouse.click(p.x + 5, p.y + 25);
    await page.keyboard.up("Control");
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();

    // frames only when the asset has several frames
    if ((await title(page).textContent()) === "Step through the frames") {
      await page.mouse.move(p.x, p.y);
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId("tour-check")).toBeVisible();
      await next(page).click();
    }

    // centre camera: the real toolbar button
    await expect(title(page)).toHaveText("Center the camera");
    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await expect(next(page)).toContainText("Finish");
    await next(page).click();
    await expect(dialog(page)).toHaveCount(0);

    await expect.poll(async () => (await statusOf(carol.id, "navigation-3d"))?.status).toBe("COMPLETED");
    // the lesson's own checkpoints are satisfied by the finished tour
    for (const label of ["Rotate the view", "Pan the view", "Zoom in and out", "Reset the view"]) {
      await expect(page.locator("section ul li").filter({ hasText: label }).getByLabel("Done")).toBeVisible();
    }
  });

  test("first task open: cuboid tour, real actions, skip with confirm, resume and restart", async ({ page }) => {
    const carol = await userByEmail(CAROL.email);
    await login(page, CAROL.email, CAROL.password);
    await go(page, "/annotate");
    await page.getByTestId("task-row-TASK-03").getByRole("link").click();
    await page.waitForSelector('[data-testid="workspace"]');
    await waitCloud(page);

    // navigation tour is already completed, so the task walkthrough is offered
    const intro = page.getByTestId("tour-intro");
    await expect(intro).toBeVisible({ timeout: 30_000 });
    await expect(intro).toContainText("Draw your first cuboid");
    await page.getByTestId("tour-start").click();

    await expect(title(page)).toHaveText("Read the instructions");
    await expect(next(page)).toBeDisabled();
    await page.getByRole("button", { name: "Instructions" }).click();
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();
    await page.getByRole("button", { name: "Close", exact: true }).click(); // drawer

    await expect(title(page)).toHaveText("Create a box");
    await page.getByRole("button", { name: "Top view" }).click();
    await page.waitForTimeout(400);
    await dragGround(page, [7.2, 3.8], [10.8, 6.2]);
    await expect(page.getByTestId("object-row")).toHaveCount(1);
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();

    await expect(title(page)).toHaveText("Select it");
    await page.getByTestId("object-row").first().click(); // toggles the new box off ...
    await expect(next(page)).toBeDisabled();
    await page.getByTestId("object-row").first().click(); // ... and on: a real selection
    await expect(page.getByTestId("tour-check")).toBeVisible();
    await next(page).click();
    await expect(title(page)).toHaveText("Move it");

    // skip the rest with the X, confirm
    await page.getByTestId("tour-close").click();
    await expect(page.getByTestId("tour-skip-prompt")).toBeVisible();
    await page.getByTestId("tour-skip-cancel").click();
    await expect(title(page)).toHaveText("Move it");
    await page.getByTestId("tour-close").click();
    await page.getByTestId("tour-skip-confirm").click();
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(async () => (await statusOf(carol.id, "task-cuboid"))?.status).toBe("SKIPPED");
    expect((await statusOf(carol.id, "task-cuboid"))?.lastStepIndex).toBe(3);

    // reload: skipped tours stay away
    await page.reload();
    await page.waitForSelector('[data-testid="workspace"]');
    await page.waitForTimeout(2000);
    await expect(page.getByTestId("tour-intro")).toHaveCount(0);

    // Help menu lists the tours for this page with statuses; restart works
    await page.getByTestId("help-button").last().click();
    await expect(page.getByTestId("help-status-task-cuboid")).toHaveText("Skipped");
    await expect(page.getByTestId("help-status-navigation-3d")).toHaveText("Completed");
    await page.getByTestId("help-start-task-cuboid").click();
    await expect(page.getByTestId("tour-intro")).toBeVisible();
    await page.getByTestId("tour-start").click();
    await expect(title(page)).toHaveText("Read the instructions");
    await page.getByRole("button", { name: "Instructions" }).click();
    await next(page).click();
    await expect(title(page)).toHaveText("Create a box");
    await expect.poll(async () => (await statusOf(carol.id, "task-cuboid"))?.lastStepIndex).toBe(1);
    expect((await statusOf(carol.id, "task-cuboid"))?.status).toBe("IN_PROGRESS");

    // reload mid-tour: a Resume pill (no modal) brings the dialog back at the saved step
    await page.reload();
    await page.waitForSelector('[data-testid="workspace"]');
    const pill = page.getByTestId("tour-resume-pill");
    await expect(pill).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("tour-intro")).toHaveCount(0);
    await page.getByTestId("tour-resume").click();
    await expect(dialog(page)).toHaveAttribute("data-step", "create");
  });

  test("reviewer: first review open tour walks the review screen", async ({ page }) => {
    const reviewer = await userByEmail(REVIEWER.email);
    await db.tourProgress.deleteMany({ where: { userId: reviewer.id, tourKey: "review-first-open" } });
    const sub = await db.submission.findFirstOrThrow({ orderBy: { submittedAt: "asc" } });
    await login(page, REVIEWER.email, REVIEWER.password);
    await go(page, `/review/${sub.id}`);
    await expect(page.getByTestId("tour-intro")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("tour-start").click();
    for (let i = 0; i < 12; i++) {
      const key = await dialog(page).getAttribute("data-step");
      if (key === "reference") await page.getByTestId("toggle-reference").check();
      if (key === "select") await page.getByTestId("objects-list").getByRole("button").first().click();
      const label = await next(page).textContent();
      await next(page).click();
      if (label?.includes("Finish")) break;
    }
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(async () => (await statusOf(reviewer.id, "review-first-open"))?.status).toBe("COMPLETED");
  });
});
