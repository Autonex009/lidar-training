import { expect, test } from "@playwright/test";
import { ALICE } from "./helpers/constants";
import { db, orderedQuestions, programOf, userByEmail } from "./helpers/db";
import { go, login } from "./helpers/ui";

// T4: retry and pass the final assessment: sections unlock, progress is 100%.
test.describe.serial("T4 pass unlocks", () => {
  test("correct final answers via UI unlock navigation", async ({ page }) => {
    const alice = await userByEmail(ALICE.email);
    const programId = await programOf(alice.id);
    await login(page, ALICE.email, ALICE.password);
    await go(page, "/learn/assessment");
    for (const q of await orderedQuestions(null, programId)) {
      const idx = q.kind === "TRUE_FALSE" ? (q.correct === true ? 0 : 1) : (q.correct as number);
      await page.locator(`input[name="${q.id}"]`).nth(idx).check();
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("status")).toContainText("Passed");
    await expect(page.getByRole("status")).toContainText("unlocked");

    expect((await db.enrollment.findFirstOrThrow({ where: { userId: alice.id } })).learnCompletedAt).not.toBeNull();
    expect(await db.quizAttempt.count({ where: { userId: alice.id, isFinal: true } })).toBe(2); // every attempt stored

    await go(page, "/learn");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const label of ["Annotate", "Review", "Complete"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
    await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(0);
    await expect(page.locator("header").getByText("100%")).toBeVisible();
    await nav.getByRole("link", { name: "Annotate" }).click();
    await expect(page).toHaveURL(/\/annotate$/);
    await expect(page.getByTestId("task-row-TASK-01")).toBeVisible();
  });
});
