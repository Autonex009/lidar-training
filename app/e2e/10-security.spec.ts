import { expect, test, request as pwRequest } from "@playwright/test";
import { ALICE, BOB } from "./helpers/constants";
import { assignmentFor, createTrainee, db, userByEmail } from "./helpers/db";
import { go, login } from "./helpers/ui";
import { parseCache } from "../src/lib/pointcloud/cache";

// T10: ownership and role checks.
test.describe.serial("T10 security", () => {
  test("trainee B cannot reach trainee A's data or staff routes", async ({ page, baseURL }) => {
    const alice = await userByEmail(ALICE.email);
    const aAssign = await assignmentFor(alice.id, "TASK-03");
    const aSub = await db.submission.findFirstOrThrow({ where: { assignmentId: aAssign.id }, orderBy: { attemptNumber: "asc" } });
    createTrainee(BOB);
    const bob = await userByEmail(BOB.email);
    await db.enrollment.updateMany({ where: { userId: bob.id }, data: { learnCompletedAt: new Date() } }); // gate open: isolate ownership checks
    await login(page, BOB.email, BOB.password);

    // pages
    const r1 = await page.goto(`/annotate/${aAssign.id}`);
    expect(r1?.status()).toBe(404);
    await expect(page.locator('[data-testid="workspace"]')).toHaveCount(0);
    await go(page, `/review/${aSub.id}`);
    await expect(page).toHaveURL(/\/learn\?msg=forbidden/);
    await go(page, "/admin");
    await expect(page).toHaveURL(/\/learn\?msg=forbidden/);
    await go(page, `/admin/trainees/${alice.id}`);
    await expect(page).toHaveURL(/\/learn\?msg=forbidden/);

    // APIs with Bob's session cookies
    const api = page.request;
    const doc = { version: 1, frames: { "0": { cuboids: [] } }, flags: [], answers: {}, checkpoints: {} };
    expect((await api.post(`/api/assignments/${aAssign.id}/draft`, { data: { data: doc } })).status()).toBe(403);
    expect((await api.post(`/api/assignments/${aAssign.id}/submit`)).status()).toBe(403);
    expect((await api.post(`/api/reviews/${aSub.id}/decide`, { data: { decision: "APPROVE", score: 100, feedback: "x" } })).status()).toBe(403);
    expect((await api.post("/api/reviews/assign", { data: { submissionId: aSub.id } })).status()).toBe(403);
    expect((await api.post("/api/admin/op/user.create", { data: { name: "X", email: "x@example.com", role: "ADMIN" } })).status()).toBe(403);
    expect((await api.get(`/api/admin/trainees/${alice.id}/activity.csv`)).status()).toBe(403);
    expect((await api.post("/api/assets/upload", { multipart: { file: { name: "a.xyz", mimeType: "text/plain", buffer: Buffer.from("0 0 0\n") } } })).status()).toBe(403);
    // Alice is still approved, unaffected
    expect((await db.taskAssignment.findUniqueOrThrow({ where: { id: aAssign.id } })).status).toBe("APPROVED");
    expect(await db.user.count({ where: { email: "x@example.com" } })).toBe(0);

    // ground truth: a trainee's frame download carries no per-point labels, even when asking for them
    const asset = await db.pointCloudAsset.findFirstOrThrow({ where: { tasks: { some: { code: "TASK-03" } } } });
    for (const qs of ["", "?withLabels=1"]) {
      const res = await api.get(`/api/assets/${asset.id}/frames/0${qs}`);
      expect(res.status()).toBe(200);
      const cloud = parseCache(new Uint8Array(await res.body()));
      expect(cloud.labels).toBeUndefined();
      expect(cloud.pointCount).toBeGreaterThan(100);
    }
    // metadata endpoint never carries reference data
    const meta = JSON.stringify(await (await api.get(`/api/assets/${asset.id}`)).json());
    expect(meta).not.toMatch(/referenceAnnotation|plantedErrors|reference/i);

    // anonymous
    const anon = await pwRequest.newContext({ baseURL });
    // middleware redirects anonymous callers to /login (or the route answers 401); never data
    const denied = [302, 307, 401];
    expect(denied).toContain((await anon.get(`/api/assets/${asset.id}/frames/0`, { maxRedirects: 0 })).status());
    expect(denied).toContain((await anon.post(`/api/assignments/${aAssign.id}/draft`, { data: { data: doc }, maxRedirects: 0 })).status());
    expect(denied).toContain((await anon.get("/api/notifications", { maxRedirects: 0 })).status());
    const redirect = await anon.get("/learn", { maxRedirects: 0 });
    expect([302, 307]).toContain(redirect.status());
    await anon.dispose();
  });
});
