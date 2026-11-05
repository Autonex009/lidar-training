import { expect, test } from "@playwright/test";
import { ALICE } from "./helpers/constants";
import { db, orderedQuestions, programOf, userByEmail } from "./helpers/db";
import { go, login, logout } from "./helpers/ui";

// T2: complete a lesson and pass a module quiz through the UI; state survives logout/login.
test.describe.serial("T2 progression persists", () => {
  test("lesson + module quiz via UI, then logout/login", async ({ page }) => {
    const alice = await userByEmail(ALICE.email);
    const programId = await programOf(alice.id);
    const mod = await db.module.findFirstOrThrow({ where: { programId, isMandatory: true }, orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } });
    await login(page, ALICE.email, ALICE.password);

    // Lesson 1 has no interactive checkpoints.
    await go(page, `/learn/${mod.key}?l=0`);
    await expect(page.getByRole("heading", { name: mod.lessons[0].title })).toBeVisible();
    await page.getByRole("button", { name: "Mark lesson complete" }).click();
    await expect(page.getByText("Lesson complete")).toBeVisible();

    // Module quiz: answer everything correctly (answers read from the DB).
    await go(page, `/learn/${mod.key}/quiz`);
    const qs = await orderedQuestions(mod.id, programId);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      const idx = q.kind === "TRUE_FALSE" ? (q.correct === true ? 0 : 1) : (q.correct as number);
      await page.locator(`input[name="${q.id}"]`).nth(idx).check();
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("status")).toContainText("Passed");

    await go(page, "/learn");
    const row = page.getByTestId(`module-card-${mod.key}`);
    await expect(row).toContainText(`1/${mod.lessons.length}`);
    await expect(row).toContainText("Quiz 100%");

    await logout(page);
    await login(page, ALICE.email, ALICE.password);
    await go(page, "/learn");
    const row2 = page.getByTestId(`module-card-${mod.key}`);
    await expect(row2).toContainText(`1/${mod.lessons.length}`);
    await expect(row2).toContainText("Quiz 100%");
    await go(page, `/learn/${mod.key}?l=0`);
    await expect(page.getByText("Lesson complete")).toBeVisible();
    // gate still locked: only part of Learn is done
    await expect(page.getByRole("navigation", { name: "Primary" }).locator('[aria-disabled="true"]')).toHaveCount(3);
  });
});
