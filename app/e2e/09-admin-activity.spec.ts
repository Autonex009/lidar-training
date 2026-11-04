import { expect, test } from "@playwright/test";
import { ADMIN, ALICE } from "./helpers/constants";
import { go, login } from "./helpers/ui";
import { userByEmail } from "./helpers/db";

// T9: admin timeline for the trainee contains every expected event type.
test.describe.serial("T9 admin activity", () => {
  test("trainee detail timeline", async ({ page }) => {
    const alice = await userByEmail(ALICE.email);
    await login(page, ADMIN.email, ADMIN.password);
    await go(page, `/admin/trainees/${alice.id}`);
    await expect(page.getByRole("heading", { name: ALICE.name })).toBeVisible();
    const rows = page.getByTestId("timeline-row");
    await expect(rows.first()).toBeVisible();
    const types = (await rows.locator("td:nth-child(2)").allInnerTexts()).map((t) => t.trim());
    for (const t of ["LOGIN", "LESSON_COMPLETED", "QUIZ_ATTEMPTED", "TASK_SUBMITTED", "REVISION_REQUESTED", "TASK_APPROVED"]) expect(types, t).toContain(t);
  });
});
