import { describe, expect, it } from "vitest";
import { encodeCache } from "../pointcloud/cache";
import { generateScene } from "./generate";
import { DEMO_SCENE_KEYS, buildDemoScene, getDemoScene } from "./scenes";
import { mulberry32 } from "./prng";
import type { ReferenceCuboid } from "./types";

function inside(p: [number, number, number], c: ReferenceCuboid, tol: number) {
  const dx = p[0] - c.center[0], dy = p[1] - c.center[1], dz = p[2] - c.center[2];
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  const lx = dx * cy + dy * sy, ly = -dx * sy + dy * cy;
  return Math.abs(lx) <= c.dims[0] / 2 + tol && Math.abs(ly) <= c.dims[1] / 2 + tol && Math.abs(dz) <= c.dims[2] / 2 + tol;
}

describe("prng", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(5), b = mulberry32(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("synthetic scenes", () => {
  it("same seed gives identical bytes", () => {
    const spec = getDemoScene("demo-cuboid-basic").spec;
    const a = encodeCache(generateScene(spec).cloud), b = encodeCache(generateScene(spec).cloud);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const c = encodeCache(generateScene({ ...spec, seed: spec.seed + 1 }).cloud);
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });

  for (const key of DEMO_SCENE_KEYS) {
    it(`${key}: size, labels and cuboids contain their points`, () => {
      const s = buildDemoScene(key);
      expect(s.cloud.pointCount).toBeGreaterThanOrEqual(20000);
      expect(s.cloud.pointCount).toBeLessThanOrEqual(120000);
      expect(s.cloud.labels!.semantic.length).toBe(s.cloud.pointCount);
      const frames = s.reference.frames ?? [{ index: 0, cuboids: s.reference.cuboids }];
      for (const fr of frames) {
        const cloud = s.frames[fr.index];
        const byInst = new Map(fr.cuboids.map((c) => [Number(c.id.replace("cub-", "")), c]));
        let checked = 0;
        for (let i = 0; i < cloud.pointCount; i++) {
          const inst = cloud.labels!.instance[i];
          if (!inst) continue;
          const c = byInst.get(inst);
          expect(c, `instance ${inst} has a cuboid in frame ${fr.index}`).toBeDefined();
          const p: [number, number, number] = [cloud.positions[i * 3], cloud.positions[i * 3 + 1], cloud.positions[i * 3 + 2]];
          if (!inside(p, c!, 0.15)) throw new Error(`${key} frame ${fr.index}: point ${i} outside cuboid ${c!.id}`);
          checked++;
        }
        expect(checked).toBeGreaterThan(0);
      }
    });
  }

  it("sequence: tracked object disappears for two frames", () => {
    const s = buildDemoScene("demo-sequence");
    expect(s.frames.length).toBe(8);
    const counts = s.reference.frames!.map((f) => f.cuboids.length);
    expect(counts[2] - counts[3]).toBe(1);
    expect(counts[3]).toBe(counts[4]);
    expect(counts[5]).toBe(counts[2]);
  });

  it("errors scene lists planted errors", () => {
    const s = buildDemoScene("demo-errors");
    expect(s.plantedErrors!.map((e) => e.type).sort()).toEqual(["bad_yaw", "duplicate", "missing_object", "wrong_class", "wrong_dims"]);
    // 6 reference boxes: -1 missing, +1 duplicate
    expect(s.initialAnnotation!.length).toBe(s.reference.cuboids.length);
  });
});
