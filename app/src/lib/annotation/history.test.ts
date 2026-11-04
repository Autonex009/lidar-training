import { describe, expect, it } from "vitest";
import { canRedo, canUndo, commit, createHistory, endGesture, redo, replacePresent, undo } from "./history";
import { applyEdit, editorReducer, initEditor } from "./reducer";
import { emptyDocument, type Cuboid } from "./types";

const box = (id: string): Cuboid => ({ id, label: "Vehicle", center: [0, 0, 1], dims: [4, 2, 1.5], yaw: 0, attributes: {} });

describe("history", () => {
  it("commits, undoes and redoes", () => {
    const d0 = emptyDocument(), d1 = applyEdit(d0, { type: "addCuboid", frame: 0, cuboid: box("a") });
    let h = commit(createHistory(d0), d1);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(d0);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(d1);
  });
  it("clears redo on a new commit and ignores no-ops", () => {
    const d0 = emptyDocument();
    let h = commit(createHistory(d0), applyEdit(d0, { type: "addCuboid", frame: 0, cuboid: box("a") }));
    h = undo(h);
    expect(commit(h, h.present)).toBe(h);
    h = commit(h, applyEdit(d0, { type: "addCuboid", frame: 0, cuboid: box("b") }));
    expect(canRedo(h)).toBe(false);
  });
  it("collapses a gesture into one undo step", () => {
    const d0 = applyEdit(emptyDocument(), { type: "addCuboid", frame: 0, cuboid: box("a") });
    let h = createHistory(d0);
    h = replacePresent(h, applyEdit(h.present, { type: "patchCuboid", frame: 0, id: "a", patch: { yaw: 1 } }));
    h = replacePresent(h, applyEdit(h.present, { type: "patchCuboid", frame: 0, id: "a", patch: { yaw: 2 } }));
    h = endGesture(h, d0);
    expect(h.past).toHaveLength(1);
    expect(undo(h).present.frames[0].cuboids[0].yaw).toBe(0);
  });
});

describe("editor reducer", () => {
  it("keeps answers across undo and deletes flags with their box", () => {
    let s = initEditor(emptyDocument());
    s = editorReducer(s, { type: "edit", edit: { type: "addCuboid", frame: 0, cuboid: box("a") }, select: "a" });
    s = editorReducer(s, { type: "edit", edit: { type: "addFlag", flag: { id: "f", cuboidId: "a", reason: "sparse" } } });
    s = editorReducer(s, { type: "edit", edit: { type: "setAnswer", key: "q", value: "hello" } });
    s = editorReducer(s, { type: "undo" });
    expect(s.history.present.answers.q).toBe("hello");
    s = editorReducer(s, { type: "redo" });
    s = editorReducer(s, { type: "edit", edit: { type: "deleteCuboid", frame: 0, id: "a" } });
    expect(s.history.present.flags).toHaveLength(0);
    expect(s.selectedId).toBeNull();
  });
  it("copies boxes between frames keeping track ids and interpolates gaps", () => {
    let d = applyEdit(emptyDocument(), { type: "addCuboid", frame: 0, cuboid: { ...box("a"), trackId: 7 } });
    d = applyEdit(d, { type: "copyFrame", from: 0, to: 1, newIds: ["b"] });
    expect(d.frames[1].cuboids[0]).toMatchObject({ id: "b", trackId: 7 });
    d = applyEdit(d, { type: "copyFrame", from: 0, to: 1, newIds: ["c"] });
    expect(d.frames[1].cuboids).toHaveLength(1);
    d = applyEdit(d, { type: "addCuboid", frame: 4, cuboid: { ...box("z"), trackId: 7, center: [8, 0, 1] } });
    d = applyEdit(d, { type: "interpolate", trackId: 7, from: 1, to: 4, newIds: ["i2", "i3"] });
    expect(d.frames[2].cuboids[0].center[0]).toBeCloseTo(8 / 3);
    expect(d.frames[3].cuboids[0].center[0]).toBeCloseTo(16 / 3);
  });
});
