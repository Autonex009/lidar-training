import { describe, expect, it } from "vitest";
import { tourEventsForAction } from "./tourEvents";
import type { Edit } from "./reducer";

const patch = (p: Record<string, unknown>) => tourEventsForAction({ type: "edit", edit: { type: "patchCuboid", frame: 0, id: "c", patch: p } as Edit });

describe("editor action -> tour events", () => {
  it("passes through plain edit types", () => {
    expect(tourEventsForAction({ type: "edit", edit: { type: "addFlag", flag: { id: "f", reason: "r" } } as Edit })).toEqual(["addFlag"]);
    expect(tourEventsForAction({ type: "undo" })).toEqual(["undo"]);
  });
  it("classifies cuboid patches", () => {
    expect(patch({ center: [0, 0, 0] })).toEqual(["patchCuboid", "moveCuboid"]);
    expect(patch({ dims: [1, 1, 1], center: [0, 0, 0] })).toEqual(["patchCuboid", "resizeCuboid"]);
    expect(patch({ yaw: 1 })).toEqual(["patchCuboid", "rotateCuboid"]);
    expect(patch({ label: "Car" })).toEqual(["patchCuboid", "setLabel"]);
    expect(patch({ trackId: 3 })).toEqual(["patchCuboid", "setTrackId"]);
  });
  it("select only announces a real selection; point labels become paintPoints", () => {
    expect(tourEventsForAction({ type: "select", id: null })).toEqual([]);
    expect(tourEventsForAction({ type: "select", id: "c" })).toEqual(["select"]);
    expect(tourEventsForAction({ type: "edit", edit: { type: "setPointLabels", frame: 0 } })).toEqual(["setPointLabels", "paintPoints"]);
  });
});
