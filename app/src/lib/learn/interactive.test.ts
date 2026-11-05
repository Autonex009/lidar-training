import { describe, expect, it } from "vitest";
import type { DecisionCard } from "@/content";
import { M5_CARDS, M6_CARDS } from "@/content/interactive";
import { buildDemoScene } from "@/lib/synthetic/scenes";
import {
  classifyMistakes, classifyPatch, countLabel, findHit, fitQuality, gradeCount, gradeTallest, mistakeSummary, pointInCuboid, pointInFootprint,
  resolveFindTarget, scoreDecisionCards, seededShuffle, tallestClass, yawErrorPi, type RefBox,
} from "./interactive";

const card = (id: string, correct: number): DecisionCard => ({ id, title: id, scenario: "", choices: [{ label: "a", why: "" }, { label: "b", why: "" }], correct });

describe("scoreDecisionCards", () => {
  const cards = [card("a", 0), card("b", 1), card("c", 0), card("d", 1), card("e", 0)];
  it("passes at 80% with every card answered", () => {
    const s = scoreDecisionCards(cards, { a: 0, b: 1, c: 0, d: 1, e: 1 });
    expect(s).toMatchObject({ correctCount: 4, pct: 80, passed: true, allAnswered: true, wrongIds: ["e"] });
  });
  it("fails below 80% and lists the wrong cards for a retry", () => {
    const s = scoreDecisionCards(cards, { a: 0, b: 0, c: 1, d: 1, e: 0 });
    expect(s.pct).toBe(60);
    expect(s.passed).toBe(false);
    expect(s.wrongIds).toEqual(["b", "c"]);
  });
  it("does not pass until every card is answered", () => {
    const s = scoreDecisionCards(cards, { a: 0, b: 1, c: 0, d: 1 });
    expect(s).toMatchObject({ answered: 4, allAnswered: false, passed: false, wrongIds: [] });
  });
  it("a retried card counts again after it is corrected", () => {
    const first = scoreDecisionCards(cards, { a: 0, b: 0, c: 1, d: 1, e: 0 });
    const fixed = { a: 0, b: 1, c: 0, d: 1, e: 0 };
    expect(first.passed).toBe(false);
    expect(scoreDecisionCards(cards, fixed)).toMatchObject({ pct: 100, passed: true, wrongIds: [] });
  });
  it("honours a custom pass mark and an empty deck", () => {
    expect(scoreDecisionCards(cards, { a: 0, b: 1, c: 0, d: 0, e: 0 }, 100).passed).toBe(false);
    expect(scoreDecisionCards([], {}).passed).toBe(false);
  });
  it("authored decks: m5 has 6 scenarios, m6 has 5, each with 2-4 choices and a valid answer", () => {
    expect(M5_CARDS.cards).toHaveLength(6);
    expect(M6_CARDS.cards).toHaveLength(5);
    for (const c of [...M5_CARDS.cards, ...M6_CARDS.cards]) {
      expect(c.choices.length).toBeGreaterThanOrEqual(2);
      expect(c.choices.length).toBeLessThanOrEqual(4);
      expect(c.correct).toBeGreaterThanOrEqual(0);
      expect(c.correct).toBeLessThan(c.choices.length);
      expect(c.choices.every((x) => x.why.length > 10)).toBe(true);
    }
  });
});

describe("find-object hit test", () => {
  const car: RefBox = { label: "Vehicle", center: [10, 5, 0.75], dims: [4.5, 1.9, 1.5], yaw: Math.PI / 4 };
  it("pointInCuboid respects yaw", () => {
    // 2 m along the heading (45 deg) is inside (half length 2.25); 2 m along x would be outside the narrow width
    const along: [number, number, number] = [10 + 2 * Math.cos(Math.PI / 4), 5 + 2 * Math.sin(Math.PI / 4), 0.75];
    expect(pointInCuboid(along, car)).toBe(true);
    const across: [number, number, number] = [10 + 2 * Math.cos(-Math.PI / 4), 5 + 2 * Math.sin(-Math.PI / 4), 0.75];
    expect(pointInCuboid(across, car)).toBe(false); // 2 m across a 1.9 m wide box
    expect(pointInCuboid([12, 5, 0.75], { ...car, yaw: 0 })).toBe(true);
    expect(pointInCuboid([12, 5, 0.75], { ...car, yaw: Math.PI / 2 })).toBe(false);
  });
  it("margin and height bounds", () => {
    expect(pointInCuboid([10, 5, 2.0], car)).toBe(false);
    expect(pointInCuboid([10, 5, 2.0], car, 0.6)).toBe(true);
    expect(pointInFootprint([10, 5], car)).toBe(true);
  });
  const t = resolveFindTarget({ kind: "object", label: "Vehicle" }, [car, { ...car, center: [-30, 0, 0.75], label: "Pole" }]);
  it("object target: a point on the object hits, a point beside it misses", () => {
    expect(findHit(t, { pick: [10.5, 5.2, 1], ground: null, groundZ: 0 })).toBe(true);
    expect(findHit(t, { pick: [20, 5, 1], ground: null, groundZ: 0 })).toBe(false);
    expect(findHit(t, { pick: [-30, 0, 1], ground: null, groundZ: 0 })).toBe(false); // wrong class
  });
  it("object target: empty-air click falls back to the ground under the object", () => {
    expect(findHit(t, { pick: null, ground: [10, 5, 0], groundZ: 0 })).toBe(true);
    expect(findHit(t, { pick: null, ground: [25, 5, 0], groundZ: 0 })).toBe(false);
  });
  it("nearest and nth selection", () => {
    const refs: RefBox[] = [{ ...car, center: [30, 0, 0.75] }, { ...car, center: [6, 0, 0.75] }, { ...car, center: [-9, 0, 0.75] }];
    const near = resolveFindTarget({ kind: "object", label: "Vehicle", nearest: true }, refs);
    expect(near.kind === "object" && near.boxes.map((b) => b.center[0])).toEqual([6]);
    const nth = resolveFindTarget({ kind: "object", label: "Vehicle", nth: 2 }, refs);
    expect(nth.kind === "object" && nth.boxes.map((b) => b.center[0])).toEqual([-9]);
  });
  it("region target uses the radius", () => {
    const r = resolveFindTarget({ kind: "region", center: [30, 22], radius: 4 }, []);
    expect(findHit(r, { pick: [32, 24, 1], ground: null, groundZ: 0 })).toBe(true);
    expect(findHit(r, { pick: [36, 22, 1], ground: null, groundZ: 0 })).toBe(false);
  });
  it("ground target rejects clicks on objects and counts empty ground", () => {
    const g = resolveFindTarget({ kind: "ground" }, [car]);
    expect(findHit(g, { pick: [-10, -10, 0.02], ground: [-10, -10, 0], groundZ: 0 })).toBe(true);
    expect(findHit(g, { pick: [10, 5, 0.05], ground: [10, 5, 0], groundZ: 0 })).toBe(false); // ground under the car
    expect(findHit(g, { pick: [10.5, 5.2, 1.2], ground: [14, 9, 0], groundZ: 0 })).toBe(false); // a point on the car, ground hit behind it
    expect(findHit(g, { pick: [-10, -10, 1.2], ground: [-10, -9, 0], groundZ: 0 })).toBe(true); // fuzzy pick of clutter near the ray
    expect(findHit(g, { pick: [-10, -10, 1.2], ground: null, groundZ: 0 })).toBe(false);
    expect(findHit(g, { pick: null, ground: [-10, -10, 0], groundZ: 0 })).toBe(true);
  });
  it("authored prompts resolve against the real demo scenes", async () => {
    const { M1_FIND, M3_FIND } = await import("@/content/interactive");
    for (const [scene, cfg] of [["demo-occlusion", M1_FIND], ["demo-identify", M3_FIND]] as const) {
      const refs = buildDemoScene(scene).reference.cuboids as unknown as RefBox[];
      for (const p of cfg.prompts) {
        const r = resolveFindTarget(p.target, refs);
        if (r.kind === "object") expect(r.boxes.length, `${scene}:${p.id}`).toBeGreaterThan(0);
        if (p.label) expect(p.label.options).toContain(p.label.correct);
      }
    }
  });
  it("seeded order is deterministic and a permutation", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(seededShuffle(items, 11)).toEqual(seededShuffle(items, 11));
    expect([...seededShuffle(items, 11)].sort()).toEqual(items);
    expect(seededShuffle(items, 11)).not.toEqual(seededShuffle(items, 12));
  });
});

describe("mistake overlay classification", () => {
  const scene = buildDemoScene("demo-cuboid-basic");
  const pos = scene.cloud.positions;
  const ref = scene.reference.cuboids.find((c) => c.label === "Vehicle")!;
  const gz = scene.cloud.bounds.min[2];
  const scale = (f: number) => ({ center: [...ref.center] as [number, number, number], dims: ref.dims.map((d) => d * f) as [number, number, number], yaw: ref.yaw });
  it("a box much larger than the car is yellow (margin) on several faces and never red", () => {
    const m = classifyMistakes(pos, { ...scale(1.7), center: [ref.center[0], ref.center[1], ref.center[2] + 0.4] }, { groundZ: gz });
    expect(mistakeSummary(m).margins).toBeGreaterThanOrEqual(3);
    expect(Object.values(m)).not.toContain("cut");
  });
  it("a box shrunk to 60% cuts points (red)", () => {
    const m = classifyMistakes(pos, scale(0.6), { groundZ: gz });
    expect(mistakeSummary(m).cuts).toBeGreaterThanOrEqual(2);
  });
  it("a box shifted off the car flags the leading face as cutting", () => {
    const b = scale(1);
    b.center = [b.center[0] + 1.5 * Math.cos(b.yaw), b.center[1] + 1.5 * Math.sin(b.yaw), b.center[2]];
    const m = classifyMistakes(pos, b, { groundZ: gz });
    expect(m["l-"]).toBe("cut"); // the car pokes out of the rear face
    expect(m["l+"]).toBe("margin"); // and the front is empty
  });
  it("a box over empty ground is margin on every face", () => {
    const m = classifyMistakes(pos, { center: [0, -25, 0.75], dims: [3, 2, 1.5], yaw: 0 }, { groundZ: gz });
    expect(Object.values(m).every((v) => v === "margin")).toBe(true);
  });
  it("synthetic points: tight box is clean, trimmed box cuts, padded box is loose", () => {
    const pts: number[] = [];
    for (let x = -2; x <= 2; x += 0.25) for (let y = -1; y <= 1; y += 0.25) for (let z = 0.4; z <= 1.5; z += 0.1) pts.push(x, y, z);
    const tight = { center: [0, 0, 0.95] as [number, number, number], dims: [4.1, 2.1, 1.1] as [number, number, number], yaw: 0 };
    expect(Object.values(classifyMistakes(pts, tight, { groundZ: 0 }))).toEqual(Array(6).fill("ok"));
    const trimmed = { ...tight, dims: [3.0, 2.1, 1.1] as [number, number, number] };
    const t = classifyMistakes(pts, trimmed, { groundZ: 0 });
    expect(t["l+"]).toBe("cut");
    expect(t["l-"]).toBe("cut");
    const padded = { ...tight, dims: [6.0, 2.1, 1.1] as [number, number, number] };
    const p = classifyMistakes(pts, padded, { groundZ: 0 });
    expect(p["l+"]).toBe("margin");
    expect(p["w+"]).toBe("ok");
  });
});

describe("views-drill grading", () => {
  const refs = buildDemoScene("demo-nav").reference.cuboids as unknown as RefBox[];
  it("counts the reference vehicles", () => {
    expect(countLabel(refs, "Vehicle")).toBe(2);
    expect(gradeCount(2, 2)).toBe(true);
    expect(gradeCount(3, 2)).toBe(false);
    expect(gradeCount(3, 2, 1)).toBe(true);
    expect(gradeCount(Number.NaN, 2)).toBe(false);
  });
  it("tallest class among the options", () => {
    const options = ["Vehicle", "Pedestrian", "Pole", "Building"];
    expect(tallestClass(refs, options)).toBe("Building");
    expect(gradeTallest("Building", refs, options)).toBe(true);
    expect(gradeTallest("Pole", refs, options)).toBe(false);
    expect(tallestClass(refs, ["Vehicle", "Pedestrian"])).toBe("Pedestrian");
    expect(tallestClass(refs, ["Boat"])).toBeNull();
  });
});

describe("live cuboid helpers", () => {
  const box = { center: [0, 0, 0.75] as [number, number, number], dims: [4, 2, 1.5] as [number, number, number], yaw: 0.2, label: "?" };
  it("classifyPatch separates move / resize / rotate / relabel", () => {
    expect(classifyPatch(box, { center: [0.5, 0, 0.75] })).toMatchObject({ moved: true, resized: false, rotated: false });
    expect(classifyPatch(box, { yaw: 0.25 })).toMatchObject({ rotated: true, moved: false });
    expect(classifyPatch(box, { center: [...box.center], dims: [4.4, 2, 1.5], yaw: box.yaw })).toMatchObject({ resized: true, moved: false, rotated: false });
    expect(classifyPatch(box, { label: "Vehicle" }).relabelled).toBe(true);
    expect(classifyPatch(box, { label: "?" }).relabelled).toBe(false);
  });
  it("fitQuality: identical box is perfect; yaw error ignores a half turn", () => {
    const q = fitQuality(box, box);
    expect(q.iou).toBeCloseTo(1, 5);
    expect(q.centerErr).toBe(0);
    expect(fitQuality({ ...box, yaw: box.yaw + Math.PI }, box).yawErrDeg).toBeCloseTo(0, 5);
    expect(yawErrorPi(0.1, 0.1 + Math.PI / 2)).toBeCloseTo(Math.PI / 2, 5);
    expect(fitQuality({ ...box, center: [3, 4, 0.75] }, box).centerErr).toBeCloseTo(5, 5);
  });
});

describe("mistake overlay on a real car", () => {
  const scene = buildDemoScene("demo-cuboid-basic");
  const ref = scene.reference.cuboids.find((c) => c.label === "Vehicle")!;
  it("the reference box is not flagged for cutting (surface noise is tolerated)", () => {
    const m = classifyMistakes(scene.cloud.positions, ref, { groundZ: scene.cloud.bounds.min[2] });
    expect(mistakeSummary(m).cuts).toBe(0);
  });
});
