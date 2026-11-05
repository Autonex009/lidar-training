import { describe, expect, it } from "vitest";
import { getDemoScene } from "@/lib/synthetic/scenes";
import { foundations } from "./foundations";
import { M4_SPOT, M6_SPOT } from "./interactive";

const WIDGETS = ["cuboid-live", "find-object", "decision-cards", "spot-the-error", "views-drill"];

describe("foundations interactive lessons", () => {
  it("checkpoint keys are unique within every lesson (they are persisted per lesson)", () => {
    for (const m of foundations.modules) for (const l of m.lessons) {
      const keys = l.blocks.flatMap((b) => (b.type === "interactive" ? b.checkpoints.map((c) => c.key) : []));
      expect(new Set(keys).size, `${m.key} / ${l.title}`).toBe(keys.length);
    }
  });
  it("each new widget kind is placed in the intended modules", () => {
    const where = (w: string) => foundations.modules.filter((m) => m.lessons.some((l) => l.blocks.some((b) => b.type === "interactive" && b.widget === w))).map((m) => m.key.split("-")[0]);
    expect(where("find-object")).toEqual(["m1", "m3"]);
    expect(where("views-drill")).toEqual(["m2"]);
    expect(where("cuboid-live")).toEqual(["m4"]);
    expect(where("spot-the-error")).toEqual(["m4", "m6"]);
    expect(where("decision-cards")).toEqual(["m5", "m6"]);
    // the old slider widget is no longer used in the foundations
    expect(where("cuboid")).toEqual([]);
  });
  it("widgets carry the config they need and checkpoints that match it", () => {
    for (const m of foundations.modules) for (const l of m.lessons) for (const b of l.blocks) {
      if (b.type !== "interactive" || !WIDGETS.includes(b.widget)) continue;
      const keys = b.checkpoints.map((c) => c.key);
      if (b.widget === "find-object") { expect(b.find?.prompts.length).toBeGreaterThanOrEqual(3); expect(b.find!.prompts.length).toBeLessThanOrEqual(5); b.find!.prompts.forEach((p) => expect(keys).toContain(p.id)); }
      if (b.widget === "spot-the-error") { expect(b.spot?.prompts).toHaveLength(3); b.spot!.prompts.forEach((p) => expect(keys).toContain(p.id)); }
      if (b.widget === "decision-cards") expect(keys).toEqual(expect.arrayContaining(["answered", "passed"]));
      if (b.widget === "views-drill") expect(keys).toEqual(["top-view", "top-count", "front-view", "front-tallest"]);
      if (b.widget === "cuboid-live") expect(keys).toEqual(["created", "moved", "resized", "rotated", "fit", "label"]);
      if (b.sceneKey) expect(() => getDemoScene(b.sceneKey as string)).not.toThrow();
    }
  });
  it("spot-the-error targets exist in the demo-errors initial annotation", () => {
    const ids = new Set(getDemoScene("demo-errors").initialAnnotation?.map((c) => c.id));
    for (const p of [...M4_SPOT.prompts, ...M6_SPOT.prompts]) for (const t of p.targets) expect(ids.has(t), t).toBe(true);
  });
  it("lessons stay between 3 and 7 minutes", () => {
    for (const m of foundations.modules.filter((x) => x.isMandatory)) for (const l of m.lessons) {
      expect(l.estimatedMinutes, `${m.key} / ${l.title}`).toBeGreaterThanOrEqual(3);
      expect(l.estimatedMinutes, `${m.key} / ${l.title}`).toBeLessThanOrEqual(7);
    }
  });
});
