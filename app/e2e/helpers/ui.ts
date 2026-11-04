import { expect, type Browser, type Page } from "@playwright/test";

const flat = (s: string) => s.replace(/\s+/g, " ").trim();
export { flat };

/** page.goto that retries when a first-time dev compile aborts the navigation (net::ERR_ABORTED / frame detached). */
export async function go(page: Page, url: string) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(url);
      return;
    } catch (e) {
      if (i >= 3 || !/ERR_ABORTED|interrupted by another navigation/.test(String(e))) throw e;
      await page.waitForTimeout(1000);
    }
  }
}

export async function login(page: Page, email: string, password: string) {
  await go(page, "/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(learn|review|annotate|admin)/, { timeout: 120_000 });
}

export async function logout(page: Page) {
  await page.locator('header button[aria-haspopup="menu"]').click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL(/\/login/);
}

export async function newSession(browser: Browser, email: string, password: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, password);
  return page;
}

export async function waitCloud(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { __engine?: { getCloud(): unknown } }).__engine?.getCloud()), null, { timeout: 120_000 });
  await page.waitForTimeout(600);
}

export async function screenOf(page: Page, x: number, y: number, z?: number): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(([px, py, pz]) => {
    const eng = (window as unknown as { __engine: { projectToScreen(p: number[]): { x: number; y: number } | null; groundLevel: number } }).__engine;
    return eng.projectToScreen([px as number, py as number, (pz as number | undefined) ?? eng.groundLevel]);
  }, [x, y, z]);
  expect(p, "projectToScreen").not.toBeNull();
  return p!;
}

/** Real mouse drag between two ground points (top view). */
export async function dragGround(page: Page, from: [number, number], to: [number, number]) {
  const a = await screenOf(page, from[0], from[1]);
  const b = await screenOf(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}
