import { describe, expect, it } from "vitest";
import { fitCuboidToPoints, fitCuboidWithYaw } from "./fit";

/** Dense points on a car-like block (4 x 2 x 1.5, centre 10,5, yaw 0.4) plus a ground grid. */
function scene(yaw = 0.4) {
  const pts: number[] = [];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let u = -2; u <= 2; u += 0.2) for (let v = -1; v <= 1; v += 0.2) for (let z = 0.2; z <= 1.5; z += 0.25) pts.push(10 + u * c - v * s, 5 + u * s + v * c, z);
  for (let x = 0; x < 20; x += 0.5) for (let y = 0; y < 12; y += 0.5) pts.push(x, y, 0);
  return Float32Array.from(pts);
}

describe("fitCuboidToPoints", () => {
  it("snaps a loose box onto the object points and ignores ground", () => {
    const r = fitCuboidToPoints(scene(), { center: [10.2, 5.1, 1], dims: [4.8, 2.8, 2], yaw: 0.4 }, { groundZ: 0 })!;
    expect(r.dims[0]).toBeCloseTo(4, 0);
    expect(r.dims[1]).toBeCloseTo(2, 0);
    expect(r.dims[2]).toBeCloseTo(1.5, 1);
    expect(r.center[0]).toBeCloseTo(10, 1);
    expect(r.center[1]).toBeCloseTo(5, 1);
    expect(r.center[2]).toBeCloseTo(0.75, 1);
  });
  it("returns null when no object points are inside", () => {
    expect(fitCuboidToPoints(scene(), { center: [1, 1, 1], dims: [1, 1, 2], yaw: 0 }, { groundZ: 0 })).toBeNull();
  });
  it("estimates the heading of a rotated object", () => {
    const r = fitCuboidWithYaw(scene(0.4), { center: [10, 5, 1.25], dims: [5, 5, 2.5], yaw: 0 }, { groundZ: 0, margin: 0.3, headroom: 0 })!;
    const d = Math.abs(((r.yaw - 0.4 + Math.PI) % Math.PI + Math.PI) % Math.PI);
    expect(Math.min(d, Math.PI - d)).toBeLessThan(0.15);
    expect(r.dims[0]).toBeGreaterThan(r.dims[1]);
  });
});
