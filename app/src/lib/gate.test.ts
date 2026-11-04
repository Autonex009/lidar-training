import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { computeGateForRole, computeGateState } from "@/lib/gate";

describe("gate", () => {
  it("locks annotate/review/complete until learn is complete", () => {
    const g = computeGateState(false);
    expect(g.learnComplete).toBe(false);
    expect(g.unlocked).toEqual({ annotate: false, review: false, complete: false });
    expect(g.reasons.length).toBeGreaterThan(0);
  });

  it("unlocks everything when learn is complete", () => {
    const g = computeGateState(true);
    expect(g.unlocked).toEqual({ annotate: true, review: true, complete: true });
    expect(g.reasons).toEqual([]);
  });

  it("staff bypass the gate", () => {
    expect(computeGateForRole("REVIEWER", false).unlocked.annotate).toBe(true);
    expect(computeGateForRole("ADMIN", false).unlocked.complete).toBe(true);
    expect(computeGateForRole("TRAINEE", false).unlocked.annotate).toBe(false);
  });
});
