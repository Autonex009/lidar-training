import { describe, expect, it } from "vitest";
import { DEFAULT_ATTRIBUTES, type TaskRules } from "./task-config";
import { emptyDocument, u16ToB64, type AnnotationDocument, type Cuboid } from "./types";
import { validateForSubmit } from "./validate";

const box = (o: Partial<Cuboid> = {}): Cuboid => ({ id: Math.random().toString(36), label: "Vehicle", center: [0, 0, 0.75], dims: [4.5, 1.9, 1.5], yaw: 0, attributes: { occlusion: "none" }, ...o });
const rules = (t: Partial<TaskRules> = {}): TaskRules => ({ annotationType: "CUBOID", classes: ["Vehicle"], requiredAttributes: ["occlusion"], attributes: DEFAULT_ATTRIBUTES, ...t });
const docWith = (cubs: Cuboid[], frame = 0): AnnotationDocument => ({ ...emptyDocument(), frames: { [frame]: { cuboids: cubs } } });
const codes = (r: ReturnType<typeof validateForSubmit>) => r.errors.map((e) => e.code);

describe("validateForSubmit", () => {
  it("requires at least one cuboid, a label and required attributes", () => {
    expect(codes(validateForSubmit(emptyDocument(), rules()))).toContain("no_cuboids");
    const r = validateForSubmit(docWith([box({ label: "" }), box({ attributes: {} })]), rules());
    expect(codes(r)).toEqual(expect.arrayContaining(["no_label", "missing_attribute"]));
    expect(validateForSubmit(docWith([box()]), rules()).ok).toBe(true);
  });
  it("warns, but does not block, on size outliers and flags", () => {
    const d = docWith([box({ dims: [20, 9, 7] }), box({ dims: [0.5, 0.3, 0.2] })]);
    d.flags.push({ id: "f", reason: "sparse" });
    const r = validateForSubmit(d, rules());
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["large_box", "small_box", "flags_present"]));
  });
  it("checks inspection checkpoints and unanswered questions", () => {
    const t = rules({ annotationType: "INSPECTION", checkpoints: [{ key: "a", label: "A", kind: "control_used" }], questions: [{ key: "q", prompt: "Why?", kind: "free_text" }] });
    expect(codes(validateForSubmit(emptyDocument(), t))).toEqual(expect.arrayContaining(["checkpoint_missing", "unanswered"]));
    const d = emptyDocument(); d.checkpoints.a = true; d.answers.q = "because";
    expect(validateForSubmit(d, t).ok).toBe(true);
  });
  it("requires error reports for error detection", () => {
    expect(codes(validateForSubmit(docWith([box()]), rules({ annotationType: "ERROR_DETECTION" })))).toContain("no_errors_reported");
  });
  it("requires labelled points for segmentation", () => {
    const t = rules({ annotationType: "SEMANTIC_SEG" });
    expect(codes(validateForSubmit(emptyDocument(), t))).toContain("no_points");
    const d = emptyDocument(); d.pointLabels = [{ frame: 0, semantic: u16ToB64(new Uint16Array([0, 2, 0])) }];
    expect(validateForSubmit(d, t).ok).toBe(true);
  });
  it("rejects duplicate track ids within a frame for tracking", () => {
    const t = rules({ annotationType: "TRACKING", requiredAttributes: [] });
    const r = validateForSubmit(docWith([box({ trackId: 1 }), box({ trackId: 1 }), box({})]), t);
    expect(codes(r)).toEqual(expect.arrayContaining(["duplicate_track", "no_track"]));
    expect(validateForSubmit(docWith([box({ trackId: 1 }), box({ trackId: 2 })]), t).ok).toBe(true);
  });
  it("identification needs a class or a flagged reason per object", () => {
    const t = rules({ annotationType: "IDENTIFICATION", requiredAttributes: [] });
    const unknown = box({ id: "u", label: "?" });
    expect(codes(validateForSubmit(docWith([unknown]), t))).toContain("unidentified");
    const d = docWith([unknown]); d.flags.push({ id: "f", cuboidId: "u", reason: "tiny, no shape evidence" });
    expect(validateForSubmit(d, t).ok).toBe(true);
  });
});
