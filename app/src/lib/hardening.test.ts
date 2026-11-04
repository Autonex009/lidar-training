// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeCache, frameFileName, frameNoLabelsFileName, parseCache, stripLabelsFromCache } from "@/lib/pointcloud/cache";
import type { NormalizedCloud } from "@/lib/pointcloud/types";
import { isPublicPath } from "@/auth.config";
import { hitRateLimit, isRateLimited, resetRateLimits } from "@/lib/rate-limit";
import { buildWorkspaceTask } from "@/lib/tasks/runtime";

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => session.user }));
vi.mock("@/lib/db", () => ({
  db: { pointCloudAsset: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === "leaktest" ? { cachePath: "__leaktest__", frameCount: 2 } : null) } },
}));

function cloud(): NormalizedCloud {
  const n = 5;
  return {
    pointCount: n, positions: Float32Array.from({ length: n * 3 }, (_, i) => i), intensity: Float32Array.from({ length: n }, (_, i) => i / 10),
    labels: { semantic: Uint16Array.from([1, 2, 3, 4, 5]), instance: Uint16Array.from([9, 9, 8, 8, 7]) },
    upAxis: "Z", bounds: { min: [0, 0, 0], max: [1, 1, 1] }, frameIndex: 0, metadata: {},
  };
}

describe("cache label stripping", () => {
  it("removes labels, keeps geometry/intensity", () => {
    const stripped = parseCache(stripLabelsFromCache(encodeCache(cloud())));
    expect(stripped.labels).toBeUndefined();
    expect(Array.from(stripped.positions)).toEqual(Array.from(cloud().positions));
    expect(Array.from(stripped.intensity!)).toEqual(Array.from(cloud().intensity!));
    expect(frameNoLabelsFileName(3)).toBe("frame_003.nolabels.bin");
  });
});

describe("GET /api/assets/[id]/frames/[n] label policy", () => {
  const dir = path.join(process.cwd(), "data", "assets", "__leaktest__");
  let GET: typeof import("@/app/api/assets/[id]/frames/[n]/route")["GET"];
  beforeAll(async () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, frameFileName(0)), encodeCache(cloud()));
    ({ GET } = await import("@/app/api/assets/[id]/frames/[n]/route"));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  const call = async (qs = "") => {
    const res = await GET(new Request(`http://x/api/assets/leaktest/frames/0${qs}`), { params: Promise.resolve({ id: "leaktest", n: "0" }) });
    return res;
  };
  const hasLabels = async (res: Response) => {
    if (res.status !== 200) throw new Error(await res.text());
    return parseCache(new Uint8Array(await res.arrayBuffer())).labels !== undefined;
  };

  it("rejects anonymous", async () => {
    session.user = null;
    expect((await call()).status).toBe(401);
  });
  it("trainee never gets labels, even with ?withLabels=1; stripped copy is cached on disk", async () => {
    session.user = { id: "t", role: "TRAINEE" };
    expect(await hasLabels(await call())).toBe(false);
    expect(await hasLabels(await call("?withLabels=1"))).toBe(false);
    expect(fs.existsSync(path.join(dir, frameNoLabelsFileName(0)))).toBe(true);
  });
  it("staff only get labels when asking explicitly", async () => {
    for (const role of ["REVIEWER", "ADMIN"]) {
      session.user = { id: "s", role };
      expect(await hasLabels(await call())).toBe(false);
      expect(await hasLabels(await call("?withLabels=1"))).toBe(true);
    }
  });
});

describe("trainee task view whitelist", () => {
  it("never carries reference, planted errors or detection internals", () => {
    const task = {
      id: "t1", code: "TASK-09", title: "T", description: "d", objective: "o", instructions: "a\nb", expectedOutput: "e", hints: [], commonMistakes: [], annotationType: "ERROR_DETECTION",
      referenceAnnotation: { cuboids: [{ id: "SECRET_REF" }] }, initialAnnotation: { cuboids: [], plantedErrors: ["SECRET_PLANT"] },
      config: { errorDetection: { plantedErrorCount: 777, errorTags: [{ key: "k", name: "Tag" }] }, plantedErrors: [{ type: "SECRET_TYPE", cuboidId: "SECRET_CUB" }], reviewerRubricNote: "x" },
    };
    const json = JSON.stringify(buildWorkspaceTask(task as never, { labelSchema: { classes: [{ name: "Vehicle" }] }, navigationProfile: "orbit", upAxis: "Z" } as never, { id: "a", frameCount: 1, upAxis: "Z", isSynthetic: true, name: "n" }));
    for (const s of ["SECRET_REF", "SECRET_PLANT", "SECRET_TYPE", "SECRET_CUB", "plantedErrorCount", "777", "referenceAnnotation", "initialAnnotation"]) expect(json).not.toContain(s);
  });
});

describe("middleware public paths", () => {
  it("is exact", () => {
    for (const p of ["/login", "/register", "/setup", "/api/auth/session", "/api/auth/callback/credentials", "/api/setup"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/", "/learn", "/api/assets/x", "/api/admin/op/x", "/loginx", "/setup-evil", "/api/authx", "/api/setupx", "/api/notifications", "/admin"]) expect(isPublicPath(p)).toBe(false);
  });
});

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());
  it("blocks the 11th hit in a minute and recovers after the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(hitRateLimit("ip", 10, 60_000, t0 + i)).toBe(false);
    expect(hitRateLimit("ip", 10, 60_000, t0 + 11)).toBe(true);
    expect(isRateLimited("ip", 10, t0 + 12)).toBe(true);
    expect(hitRateLimit("other", 10, 60_000, t0)).toBe(false);
    expect(hitRateLimit("ip", 10, 60_000, t0 + 61_000)).toBe(false);
  });
});
