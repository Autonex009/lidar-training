import { describe, expect, it } from "vitest";
import { gradeAnswers } from "./grading";
import { allMandatoryComplete, computeLockedModules } from "./unlock";

describe("gradeAnswers", () => {
  const qs = [
    { id: "a", correctAnswer: 1 },
    { id: "b", correctAnswer: true },
    { id: "c", correctAnswer: 0 },
    { id: "d", correctAnswer: false },
  ];
  it("scores and passes at threshold", () => {
    const g = gradeAnswers(qs, { a: 1, b: true, c: 0, d: true }, 75);
    expect(g.correctCount).toBe(3);
    expect(g.score).toBe(75);
    expect(g.passed).toBe(true);
  });
  it("fails below threshold and treats missing answers as wrong", () => {
    const g = gradeAnswers(qs, { a: 1, b: true }, 80);
    expect(g.score).toBe(50);
    expect(g.passed).toBe(false);
    expect(g.results.find((r) => r.questionId === "c")?.correct).toBe(false);
  });
  it("does not coerce types (0 !== false)", () => {
    expect(gradeAnswers([{ id: "x", correctAnswer: false }], { x: 0 }, 50).correctCount).toBe(0);
  });
  it("empty question set never passes", () => expect(gradeAnswers([], {}, 0).passed).toBe(false));
});

describe("module unlock ordering", () => {
  const mods = [
    { id: "m2", order: 2, isMandatory: true },
    { id: "m1", order: 1, isMandatory: true },
    { id: "m3", order: 3, isMandatory: true },
    { id: "t1", order: 4, isMandatory: false },
  ];
  it("only the first mandatory module is open at start", () => {
    expect([...computeLockedModules(mods, new Set())].sort()).toEqual(["m2", "m3", "t1"]);
  });
  it("completing a module opens the next", () => {
    expect([...computeLockedModules(mods, new Set(["m1"]))].sort()).toEqual(["m3", "t1"]);
  });
  it("lock depends only on the immediate predecessor", () => {
    expect([...computeLockedModules(mods, new Set(["m2"]))].sort()).toEqual(["m2", "t1"]);
  });
  it("track modules unlock after all mandatory", () => {
    const done = new Set(["m1", "m2", "m3"]);
    expect(computeLockedModules(mods, done).size).toBe(0);
    expect(allMandatoryComplete(mods, done)).toBe(true);
    expect(allMandatoryComplete(mods, new Set(["m1"]))).toBe(false);
  });
});
