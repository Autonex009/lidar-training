import { expect, test } from "@playwright/test";
import { ALICE, REVIEWER } from "./helpers/constants";
import { go, login, waitCloud } from "./helpers/ui";

// T6: reviewer opens the queue and requests a revision with tag, feedback and instructions.
test.describe.serial("T6 review", () => {
  test("queue, open, request revision", async ({ page }) => {
    await login(page, REVIEWER.email, REVIEWER.password);
    await go(page, "/review");
    const row = page.getByTestId("queue-row-TASK-03").filter({ hasText: ALICE.name });
    await expect(row).toBeVisible();
    await expect(page.getByTestId("nav-badge-Review")).toBeVisible();
    await row.getByRole("link", { name: "Review" }).click();
    await page.waitForSelector('[data-testid="review-workspace"]');
    await waitCloud(page);
    await expect(page.getByTestId("metrics-table")).toBeVisible();
    await page.getByTestId("mode-revise").click();
    await page.getByTestId("submit-decision").click();
    await expect(page.getByTestId("decision-error")).toBeVisible(); // validation: tag/feedback required
    await page.getByRole("button", { name: "Box too large" }).click();
    await page.getByTestId("feedback-input").fill("The car box is too large; tighten it to the points.");
    await page.getByTestId("instructions-input").fill("Shrink the box to the visible points and re-check yaw in top view.");
    await page.getByTestId("submit-decision").click();
    await page.waitForURL(/\/review$/, { timeout: 30_000 });
    await expect(page.getByTestId("queue-row-TASK-03").filter({ hasText: ALICE.name })).toHaveCount(0);
  });
});
