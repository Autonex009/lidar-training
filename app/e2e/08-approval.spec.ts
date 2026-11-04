import { expect, test } from "@playwright/test";
import { ALICE, REVIEWER } from "./helpers/constants";
import { go, login } from "./helpers/ui";

// T8: reviewer approves attempt 2 with a score; trainee's Complete tab lists it.
test.describe.serial("T8 approval", () => {
  test("approve with score, Complete lists the task", async ({ browser }) => {
    const rev = await (await browser.newContext()).newPage();
    await login(rev, REVIEWER.email, REVIEWER.password);
    await go(rev, "/review");
    const row = rev.getByTestId("queue-row-TASK-03").filter({ hasText: ALICE.name });
    await expect(row).toContainText("2");
    await row.getByRole("link", { name: "Review" }).click();
    await rev.waitForSelector('[data-testid="review-workspace"]');
    await expect(rev.getByTestId("history-table")).toBeVisible();
    await rev.getByTestId("score-input").fill("84");
    await rev.getByTestId("feedback-input").fill("Better. The box now fits the points.");
    await rev.getByTestId("submit-decision").click();
    await rev.waitForURL(/\/review$/, { timeout: 30_000 });

    const tr = await (await browser.newContext()).newPage();
    await login(tr, ALICE.email, ALICE.password);
    await go(tr, "/complete");
    const approved = tr.getByTestId("approved-TASK-03");
    await expect(approved).toBeVisible();
    await expect(approved).toContainText("84");
    await expect(approved).toContainText(REVIEWER.name);
    await expect(approved).toContainText("Better. The box now fits");
    await go(tr, "/annotate");
    await expect(tr.getByTestId("task-row-TASK-03")).toContainText(/Approved/i);
  });
});
