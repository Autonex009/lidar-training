import { describe, expect, it } from "vitest";
import { boxMetrics, computeMetrics, matchBoxes, trackMetrics, yawErr2pi, yawErrPi, type ReferenceData, type RefCuboid } from "./metrics";
import { emptyDocument, u16ToB64, type Cuboid } from "./types";

const ref = (id: string, label: string, x: number, yaw = 0, trackId?: number): RefCuboid => ({ id, label, center: [x, 0, 1], dims: [4, 2, 2], yaw, trackId });
const cand = (id: string, label: string, x: number, yaw = 0, trackId?: number): Cuboid => ({ id, label, center: [x, 0, 1], dims: [4, 2, 2], yaw, attributes: {}, trackId });

describe("box metrics", () => {
  it("matches greedily by IoU and reports class, centre and yaw error", () => {
    const refs = [ref("r1", "Vehicle", 0), ref("r2", "Pedestrian", 20), ref("r3", "Pole", 40)];
    const cands = [cand("c1", "Vehicle", 0.2), cand("c2", "Vehicle", 20.1, Math.PI), cand("extra", "Vehicle", 60)];
    const m = matchBoxes(refs, cands);
    expect(m.pairs.map((p) => [p.ref, p.cand]).sort()).toEqual([[0, 0], [1, 1]]);
    const b = boxMetrics(refs, cands);
    expect(b.matched).toBe(2);
    expect(b.classMatch).toBeCloseTo(1 / 3, 3);
    expect(b.recall).toBeCloseTo(2 / 3, 3);
    expect(b.precision).toBeCloseTo(2 / 3, 3);
    expect(b.meanCenterError).toBeCloseTo(0.15, 2);
    expect(b.meanYawErrorDeg).toBeCloseTo(90, 0); // (0.. + 180) / 2
    expect(b.meanYawErrorSymmetricDeg).toBeCloseTo(0, 0);
  });
  it("yaw error helpers wrap", () => {
    expect(yawErr2pi(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2, 5);
    expect(yawErrPi(0, Math.PI)).toBeCloseTo(0, 5);
  });
  it("counts empty candidates as zero recall", () => {
    const b = boxMetrics([ref("r", "Vehicle", 0)], []);
    expect(b.recall).toBe(0);
    expect(b.meanIou).toBe(0);
  });
});

describe("tracks", () => {
  const frames = [0, 1, 2, 3].map((i) => ({ index: i, cuboids: [ref(`a${i}`, "Vehicle", i * 2, 0, 1), ref(`b${i}`, "Pedestrian", 30 + i, 0, 2)] }));
  it("is perfect with persistent ids and counts switches otherwise", () => {
    const doc = emptyDocument();
    frames.forEach((f) => { doc.frames[f.index] = { cuboids: [cand("x", "Vehicle", f.index * 2, 0, 10), cand("y", "Pedestrian", 30 + f.index, 0, 11)] }; });
    expect(trackMetrics(frames, doc).idSwitches).toBe(0);
    doc.frames[2].cuboids[0] = cand("x2", "Vehicle", 4, 0, 99);
    const t = trackMetrics(frames, doc);
    expect(t.idSwitches).toBe(2);
    expect(t.fragmented).toBe(1);
    expect(t.continuity).toBeLessThan(1);
  });
});

describe("computeMetrics", () => {
  it("scores point labels, checkpoints, answers and planted errors", () => {
    const n = 10;
    const sem = new Uint16Array([1, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
    const inst = new Uint16Array([0, 0, 0, 0, 1, 1, 1, 2, 2, 2]);
    const reference: ReferenceData = {
      cuboids: [ref("cub-1", "Vehicle", 0)],
      pointLabels: { semanticB64: u16ToB64(sem), instanceB64: u16ToB64(inst) },
    };
    const doc = emptyDocument();
    const mine = new Uint16Array(n); mine.set([1, 1, 1, 0, 2, 2, 3, 3, 3, 3]);
    const mineInst = new Uint16Array(n); mineInst.set([0, 0, 0, 0, 5, 5, 5, 6, 6, 6]);
    doc.pointLabels = [{ frame: 0, semantic: u16ToB64(mine), instance: u16ToB64(mineInst) }];
    doc.checkpoints = { a: true };
    doc.answers = { q1: "text", q2: " " };
    doc.errorsFound = [{ id: "e1", tag: "wrong_class", targetAnnotationId: "cub-9", explanation: "x" }];
    doc.frames[0] = { cuboids: [cand("c", "Vehicle", 0)] };
    const m = computeMetrics(doc, reference, {
      classIds: { Ground: 1, Vehicle: 2, Pedestrian: 3 }, checkpointKeys: ["a", "b"], questionKeys: ["q1", "q2"],
      plantedErrors: [{ type: "wrong_class", cuboidId: "cub-9" }, { type: "bad_yaw", cuboidId: "cub-8" }],
    });
    expect(m.points?.accuracy).toBeCloseTo(0.8, 3);
    expect(m.points?.instanceMatchRate).toBe(1);
    expect(m.checkpoints).toEqual({ done: 1, total: 2 });
    expect(m.answers).toEqual({ provided: 1, total: 2 });
    expect(m.errors).toMatchObject({ planted: 2, found: 1, foundWithTag: 1, falsePositives: 0 });
    expect(m.boxes?.meanIou).toBeGreaterThan(0.8);
  });
});
