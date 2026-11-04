import { expect, test } from "@playwright/test";
import { ALICE } from "./helpers/constants";
import { go, login, logout } from "./helpers/ui";

// T1: a new trainee registers; only Learn is available.
test.describe.serial("T1 new trainee", () => {
  test("register, land on Learn, gated sections are locked and inert", async ({ page }) => {
    await go(page, "/register");
    await page.fill('input[name="name"]', ALICE.name);
    await page.fill('input[name="email"]', ALICE.email);
    await page.fill('input[name="password"]', ALICE.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/learn/, { timeout: 120_000 });

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Learn" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Annotate" })).toHaveCount(0);

    for (const label of ["Annotate", "Review", "Complete"]) {
      const item = nav.locator('[aria-disabled="true"]', { hasText: label });
      await expect(item).toHaveCount(1);
      await expect(item.locator("svg[aria-label='Locked']")).toBeVisible();
      // tooltip text explains what to complete (title attribute on the wrapper + tooltip element)
      const wrapper = item.locator("xpath=..");
      await expect(wrapper).toHaveAttribute("title", /Complete all mandatory Learn modules.*pass the final assessment/);
      await expect(wrapper.locator("[role=tooltip]")).toHaveText(/pass the final assessment to unlock this section/);
      const before = page.url();
      await item.click();
      await page.waitForTimeout(300);
      expect(page.url()).toBe(before);
    }

    // direct navigation is also refused
    await go(page, "/annotate");
    await expect(page).toHaveURL(/\/learn\?msg=locked/);
    await expect(page.getByRole("status")).toContainText("locked");
    await go(page, "/complete");
    await expect(page).toHaveURL(/\/learn\?msg=locked/);

    await expect(page.getByRole("heading", { name: "Learn" }).first()).toBeVisible();
    await expect(page.getByText("0 of 6 modules complete")).toBeVisible();
    await expect(page.locator("header").getByText("0%")).toBeVisible();
    await logout(page);
    await login(page, ALICE.email, ALICE.password); // sanity: credentials work after registration
  });
});
