import { describe, expect, it } from "vitest";
import { iou3d, type Box } from "./cuboid";

const box = (o: Partial<Box> = {}): Box => ({ center: [0, 0, 1], dims: [4, 2, 2], yaw: 0, ...o });

describe("iou3d", () => {
  it("is 1 for identical boxes", () => expect(iou3d(box(), box())).toBeCloseTo(1, 6));
  it("is 0 for disjoint boxes", () => expect(iou3d(box(), box({ center: [10, 0, 1] }))).toBe(0));
  it("is 0 when separated vertically", () => expect(iou3d(box(), box({ center: [0, 0, 5] }))).toBe(0));
  it("half overlap along x gives 1/3", () => expect(iou3d(box(), box({ center: [2, 0, 1] }))).toBeCloseTo(1 / 3, 6));
  it("is symmetric", () => {
    const a = box({ yaw: 0.4 }), b = box({ center: [0.5, 0.3, 1.2], yaw: -0.2 });
    expect(iou3d(a, b)).toBeCloseTo(iou3d(b, a), 9);
  });
  it("90 degree rotation of a 4x2 box gives 4/12 footprint ratio", () => {
    // intersection 2x2=4 per unit, union 8+8-4=12
    expect(iou3d(box(), box({ yaw: Math.PI / 2 }))).toBeCloseTo(1 / 3, 6);
  });
  it("square rotated 45deg inside same-size square", () => {
    const a = box({ dims: [2, 2, 2] }), b = box({ dims: [2, 2, 2], yaw: Math.PI / 4 });
    const inter = 16 * (Math.SQRT2 - 1); // octagon footprint 8(sqrt2-1) x height 2
    expect(iou3d(a, b)).toBeCloseTo(inter / (16 - inter), 6);
  });
  it("handles a box fully inside another", () => expect(iou3d(box(), box({ dims: [2, 1, 1] }))).toBeCloseTo(2 / 16, 6));
});
