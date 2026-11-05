import { describe, expect, it } from "vitest";
import { canAdvance, closedState, feed, filterSteps, isDone, isInformational, persistPayload, pickAutoStart, tourReducer, type TourState } from "./machine";
import type { Completion, TourDefinition, TourStep } from "./types";

const step = (key: string, complete: Completion, extra: Partial<TourStep> = {}): TourStep => ({ key, title: key, instruction: key, complete, ...extra });
const ev = (name: string, detail?: unknown) => ({ name, detail });

describe("completion rules", () => {
  it("control: needs every listed detail, in any order, duplicates ignored", () => {
    const c: Completion = { kind: "control", control: "move", needs: ["W", "A", "S", "D"] };
    let p = {};
    for (const k of ["W", "W", "A", "D"]) p = feed(c, p, ev("control:move", k));
    expect(isDone(c, p)).toBe(false);
    p = feed(c, p, ev("control:move", "S"));
    expect(isDone(c, p)).toBe(true);
  });
  it("control ignores other controls and unrelated events", () => {
    const c: Completion = { kind: "control", control: "rotate" };
    expect(isDone(c, feed(c, {}, ev("control:zoom")))).toBe(false);
    expect(isDone(c, feed(c, {}, ev("rotate")))).toBe(false);
    expect(isDone(c, feed(c, {}, ev("control:rotate", "scroll")))).toBe(true);
  });
  it("count: needs N events", () => {
    const c: Completion = { kind: "event", event: "frame-changed", count: 3 };
    let p = {};
    p = feed(c, p, ev("frame-changed")); p = feed(c, p, ev("frame-changed"));
    expect(isDone(c, p)).toBe(false);
    p = feed(c, p, ev("frame-changed"));
    expect(isDone(c, p)).toBe(true);
  });
  it("all: every child must complete", () => {
    const c: Completion = { kind: "all", of: [{ kind: "event", event: "a" }, { kind: "control", control: "pan" }, { kind: "choice" }] };
    let p = feed(c, {}, ev("a"));
    p = feed(c, p, ev("control:pan"));
    expect(isDone(c, p)).toBe(false);
    p = feed(c, p, ev("tour:choice", "mouse"));
    expect(isDone(c, p)).toBe(true);
  });
  it("choice, click-target and timer complete only on their own signals; manual is immediately done", () => {
    expect(isDone({ kind: "manual" }, {})).toBe(true);
    for (const [c, e] of [[{ kind: "choice" }, "tour:choice"], [{ kind: "click-target" }, "tour:target-click"], [{ kind: "timer", ms: 5 }, "tour:timer"]] as [Completion, string][]) {
      expect(isDone(c, {})).toBe(false);
      expect(isDone(c, feed(c, {}, ev("other")))).toBe(false);
      expect(isDone(c, feed(c, {}, ev(e)))).toBe(true);
    }
  });
  it("informational steps have no check mark", () => {
    expect(isInformational({ kind: "manual" })).toBe(true);
    expect(isInformational({ kind: "all", of: [{ kind: "manual" }] })).toBe(true);
    expect(isInformational({ kind: "choice" })).toBe(false);
  });
});

describe("tour reducer", () => {
  const steps = [step("a", { kind: "event", event: "x" }), step("b", { kind: "manual" }), step("c", { kind: "event", event: "y" }, { allowSkip: true })];
  const start = (phase?: "intro" | "step" | "resume-pill", startAt?: number): TourState => tourReducer(closedState, { type: "start", key: "t", steps, phase, startAt });

  it("starts at the intro, begins at step 0", () => {
    let s = start();
    expect(s.phase).toBe("intro");
    s = tourReducer(s, { type: "begin" });
    expect(s).toMatchObject({ phase: "step", index: 0 });
  });
  it("Next is blocked until the step is done, unless allowSkip", () => {
    let s = tourReducer(start(), { type: "begin" });
    expect(canAdvance(s)).toBe(false);
    expect(tourReducer(s, { type: "next" })).toBe(s);
    s = tourReducer(s, { type: "event", evt: ev("x") });
    expect(canAdvance(s)).toBe(true);
    s = tourReducer(s, { type: "next" });
    expect(s.index).toBe(1);
    s = tourReducer(s, { type: "next" }); // manual step
    expect(s.index).toBe(2);
    expect(canAdvance(s)).toBe(true); // allowSkip
  });
  it("events only count for the current step and done flags stay when going back", () => {
    let s = tourReducer(start(), { type: "begin" });
    s = tourReducer(s, { type: "event", evt: ev("y") });
    expect(s.done[0]).toBe(false);
    s = tourReducer(s, { type: "event", evt: ev("x") });
    s = tourReducer(s, { type: "next" });
    s = tourReducer(s, { type: "back" });
    expect(s.done[0]).toBe(true);
  });
  it("events are ignored outside the step phase", () => {
    const s = start();
    expect(tourReducer(s, { type: "event", evt: ev("x") })).toBe(s);
  });
  it("finishing the last step completes the tour", () => {
    let s = tourReducer(start("step", 2), { type: "event", evt: ev("noop") });
    s = tourReducer(s, { type: "next" });
    expect(s).toMatchObject({ phase: "closed", outcome: "COMPLETED" });
  });
  it("skip needs confirmation and can be cancelled", () => {
    let s = tourReducer(start(), { type: "begin" });
    s = tourReducer(s, { type: "skip-request" });
    expect(s.phase).toBe("confirm-skip");
    expect(tourReducer(s, { type: "skip-cancel" }).phase).toBe("step");
    expect(tourReducer(s, { type: "skip-confirm" })).toMatchObject({ phase: "closed", outcome: "SKIPPED" });
  });
  it("resume starts at the saved index behind the pill", () => {
    let s = start("resume-pill", 2);
    expect(s).toMatchObject({ phase: "resume-pill", index: 2 });
    s = tourReducer(s, { type: "resume" });
    expect(s).toMatchObject({ phase: "step", index: 2 });
    expect(start("resume-pill", 99).index).toBe(2); // clamped
  });
  it("filterSteps drops steps whose `when` is false", () => {
    const def: TourDefinition = { key: "t", title: "t", intro: { heading: "", body: "", estimatedMinutes: 1 }, steps: [step("a", { kind: "manual" }), step("b", { kind: "manual" }, { when: (c) => c.hasFrames === true })] };
    expect(filterSteps(def, {}).map((x) => x.key)).toEqual(["a"]);
    expect(filterSteps(def, { hasFrames: true }).map((x) => x.key)).toEqual(["a", "b"]);
  });
});

describe("persistence payloads", () => {
  const steps = [step("a", { kind: "manual" }), step("b", { kind: "manual" })];
  it("nothing before the tour starts; IN_PROGRESS with the step index while stepping", () => {
    let s = tourReducer(closedState, { type: "start", key: "t", steps });
    expect(persistPayload(s)).toBeNull();
    s = tourReducer(s, { type: "begin" });
    expect(persistPayload(s)).toEqual({ status: "IN_PROGRESS", lastStepIndex: 0 });
    s = tourReducer(s, { type: "next" });
    expect(persistPayload(s)).toEqual({ status: "IN_PROGRESS", lastStepIndex: 1 });
  });
  it("COMPLETED on finish, SKIPPED on skip (with the index reached)", () => {
    let s = tourReducer(tourReducer(closedState, { type: "start", key: "t", steps, phase: "step" }), { type: "next" });
    s = tourReducer(s, { type: "next" });
    expect(persistPayload(s)).toEqual({ status: "COMPLETED", lastStepIndex: 1 });
    let k = tourReducer(closedState, { type: "start", key: "t", steps, phase: "step" });
    k = tourReducer(tourReducer(k, { type: "skip-request" }), { type: "skip-confirm" });
    expect(persistPayload(k)).toEqual({ status: "SKIPPED", lastStepIndex: 0 });
  });
  it("closing the intro counts as skipped at index 0", () => {
    let s = tourReducer(closedState, { type: "start", key: "t", steps });
    s = tourReducer(tourReducer(s, { type: "skip-request" }), { type: "skip-confirm" });
    expect(persistPayload(s)).toEqual({ status: "SKIPPED", lastStepIndex: 0 });
  });
});

describe("auto-start rules", () => {
  const st = (status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED", lastStepIndex = 0) => ({ status, lastStepIndex });
  it("starts the first NOT_STARTED tour (missing row = not started)", () => {
    expect(pickAutoStart(["welcome"], {})).toEqual({ key: "welcome", mode: "intro" });
  });
  it("COMPLETED and SKIPPED never auto-start; chained tours fall through", () => {
    expect(pickAutoStart(["welcome"], { welcome: st("COMPLETED") })).toBeNull();
    expect(pickAutoStart(["welcome"], { welcome: st("SKIPPED") })).toBeNull();
    expect(pickAutoStart(["navigation-3d", "task-cuboid"], { "navigation-3d": st("COMPLETED") })).toEqual({ key: "task-cuboid", mode: "intro" });
    expect(pickAutoStart(["navigation-3d", "task-cuboid"], { "navigation-3d": st("SKIPPED"), "task-cuboid": st("COMPLETED") })).toBeNull();
  });
  it("IN_PROGRESS resumes (pill) and blocks later tours in the chain", () => {
    expect(pickAutoStart(["navigation-3d", "task-cuboid"], { "navigation-3d": st("IN_PROGRESS", 3) })).toEqual({ key: "navigation-3d", mode: "resume" });
  });
});
