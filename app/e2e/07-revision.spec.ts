import { expect, test } from "@playwright/test";
import { ALICE } from "./helpers/constants";
import { assignmentFor, db, userByEmail } from "./helpers/db";
import { go, login, waitCloud } from "./helpers/ui";

// T7: trainee sees notification + banner, edits and resubmits (attempt 2).
test.describe.serial("T7 revision", () => {
  test("notification, banner, edit, resubmit", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await go(page, "/review");
    await expect(page.getByTestId("notifications-unread")).toBeVisible();
    await page.getByTestId("notifications-button").click();
    const item = page.getByTestId("notification-item").first();
    await expect(item).toContainText(/revision/i);
    await item.click();
    await page.waitForURL(/\/annotate\//, { timeout: 60_000 });
    await page.waitForSelector('[data-testid="workspace"]');
    await waitCloud(page);
    const banner = page.getByTestId("revision-banner");
    await expect(banner).toContainText("too large");
    await expect(banner).toContainText("Shrink the box");

    await page.getByTestId("object-row").first().click();
    const editor = page.getByTestId("attribute-editor");
    const before = (await editor.innerText()).match(/Centre ([^·]+)/)?.[1]?.trim();
    // edit: change the occlusion-independent label away and back through the select to dirty the doc, then nudge with keyboard if supported
    await editor.getByLabel("Label").selectOption("Cyclist");
    await editor.getByLabel("Label").selectOption("Vehicle");
    expect(before).toBeTruthy();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    await page.getByTestId("submit-button").click();
    await page.getByRole("button", { name: "Confirm and submit" }).click();
    await page.waitForURL(/\/annotate$/, { timeout: 30_000 });

    const alice = await userByEmail(ALICE.email);
    const a = await assignmentFor(alice.id, "TASK-03");
    expect(a.status).toBe("PENDING_REVIEW");
    const subs = await db.submission.findMany({ where: { assignmentId: a.id }, orderBy: { attemptNumber: "asc" } });
    expect(subs.map((s) => s.attemptNumber)).toEqual([1, 2]);
    await go(page, "/review");
    await expect(page.getByTestId("my-sub-TASK-03-2")).toBeVisible();
  });
});
