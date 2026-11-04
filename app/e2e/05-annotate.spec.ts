import { expect, test } from "@playwright/test";
import { ALICE } from "./helpers/constants";
import { approvePrerequisites, assignmentFor, db, userByEmail } from "./helpers/db";
import { dragGround, go, login, screenOf, waitCloud } from "./helpers/ui";

// T5: real mouse-drag cuboid creation (top view) on TASK-03, label change, save, reload, submit.
test.describe.serial("T5 annotate", () => {
  test("create cuboid by drag, relabel, save draft, reload, submit", async ({ page }) => {
    const alice = await userByEmail(ALICE.email);
    await approvePrerequisites(alice.id);
    await login(page, ALICE.email, ALICE.password);
    await go(page, "/annotate");
    const row = page.getByTestId("task-row-TASK-03");
    await expect(row).toBeVisible();
    await row.getByRole("link").click();
    await page.waitForSelector('[data-testid="workspace"]');
    await waitCloud(page);
    await page.getByRole("button", { name: "Top view" }).click();
    await page.waitForTimeout(400);

    await dragGround(page, [7.2, 3.8], [10.8, 6.2]); // around the car at (9, 5)
    await expect(page.getByTestId("object-row")).toHaveCount(1);
    const editor = page.getByTestId("attribute-editor");
    await editor.getByLabel("Label").selectOption("Vehicle");
    await expect(editor.getByLabel("Label")).toHaveValue("Vehicle");

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    await page.reload();
    await page.waitForSelector('[data-testid="workspace"]');
    await expect(page.getByTestId("object-row")).toHaveCount(1, { timeout: 30_000 });
    await page.getByTestId("object-row").first().click();
    await expect(page.getByTestId("attribute-editor").getByLabel("Label")).toHaveValue("Vehicle");

    await page.getByTestId("submit-button").click();
    await expect(page.getByTestId("submit-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirm and submit" }).click();
    await page.waitForURL(/\/annotate$/, { timeout: 30_000 });
    await expect(page.getByTestId("task-row-TASK-03")).toContainText(/Pending Review/i);

    const a = await assignmentFor(alice.id, "TASK-03");
    expect(a.status).toBe("PENDING_REVIEW");
    expect(await db.submission.count({ where: { assignmentId: a.id } })).toBe(1);
    void screenOf;
  });
});
