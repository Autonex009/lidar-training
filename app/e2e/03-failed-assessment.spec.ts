import { expect, test } from "@playwright/test";
import { ALICE } from "./helpers/constants";
import { completeMandatoryModules, db, orderedQuestions, programOf, userByEmail } from "./helpers/db";
import { go, login } from "./helpers/ui";

// T3: failing the final assessment keeps Annotate/Review/Complete locked.
test.describe.serial("T3 failed assessment keeps the lock", () => {
  test("mandatory modules via services, wrong final answers via UI", async ({ page }) => {
    const alice = await userByEmail(ALICE.email);
    const programId = await programOf(alice.id);
    completeMandatoryModules(alice.id);

    await login(page, ALICE.email, ALICE.password);
    await go(page, "/learn");
    await expect(page.getByText(/6 of 6 modules complete/)).toBeVisible();
    await go(page, "/learn/assessment");
    const qs = await orderedQuestions(null, programId);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      const wrong = q.kind === "TRUE_FALSE" ? (q.correct === true ? 1 : 0) : ((q.correct as number) + 1) % Math.max(q.optionCount, 2);
      await page.locator(`input[name="${q.id}"]`).nth(wrong).check();
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("status")).toContainText("Not passed");
    await expect(page.getByRole("status")).toContainText("0%");

    const enrollment = await db.enrollment.findFirstOrThrow({ where: { userId: alice.id } });
    expect(enrollment.learnCompletedAt).toBeNull();
    const attempt = await db.quizAttempt.findFirstOrThrow({ where: { userId: alice.id, isFinal: true } });
    expect(attempt.passed).toBe(false);

    await go(page, "/learn");
    await expect(page.getByRole("navigation", { name: "Primary" }).locator('[aria-disabled="true"]')).toHaveCount(3);
    await go(page, "/annotate");
    await expect(page).toHaveURL(/\/learn\?msg=locked/);
  });
});
