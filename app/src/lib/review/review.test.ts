import { describe, expect, it } from "vitest";
import type { SubmissionMetrics } from "@/lib/annotation/metrics";
import { evaluateCertification, requiredCodes } from "./certification";
import { packDecisionData, parseDecisionData } from "./decision-data";
import { describeMetrics, rubricJudgement, suggestedScore } from "./scoring";
import { decideSchema } from "./schemas";

const boxes = (o: Partial<NonNullable<SubmissionMetrics["boxes"]>> = {}): SubmissionMetrics => ({
  computedAt: "x", flags: 0,
  boxes: { refCount: 5, candCount: 5, matched: 3, meanIou: 0.5, classMatch: 1, meanCenterError: 0.3, meanYawErrorDeg: 14, meanYawErrorSymmetricDeg: 10, precision: 0.6, recall: 0.6, tpAt50: 3, ...o },
});

describe("suggested score blend", () => {
  const crit = { autoMetrics: ["classMatch", "iou3d", "centerError", "yawError"], thresholds: { centerErrorM: 0.3, iou3d: 0.5, yawErrorDeg: 10 }, reviewerWeight: 0.5 };
  it("equals the metric score until a rubric is entered", () => {
    expect(suggestedScore(boxes(), crit)).toBe(100); // every component meets its threshold
    expect(suggestedScore(boxes({ meanIou: 0.25 }), crit)).toBe(Math.round(((1 + 0.5 + 1 + 1) / 4) * 100));
  });
  it("blends the rubric judgement by reviewerWeight", () => {
    const m = boxes({ meanIou: 0.25, classMatch: 0.5 }); // auto = mean(0.5, 0.5, 1, 1) = 75
    expect(suggestedScore(m, crit)).toBe(75);
    expect(suggestedScore(m, { ...crit, reviewerWeight: 0.5 }, 100)).toBe(88); // 0.5*75 + 0.5*100 = 87.5
    expect(suggestedScore(m, { ...crit, reviewerWeight: 0 }, 0)).toBe(75);
    expect(suggestedScore(m, { ...crit, reviewerWeight: 1 }, 20)).toBe(20);
  });
  it("handles missing metrics and clamps", () => {
    expect(suggestedScore(null, crit)).toBeNull();
    expect(suggestedScore(null, crit, 64)).toBe(64);
    expect(suggestedScore(boxes({ meanCenterError: 30 }), { ...crit, autoMetrics: ["centerError"] })).toBe(1);
  });
  it("rubricJudgement is a weighted mean over entered criteria", () => {
    const r = [{ key: "a", weight: 60 }, { key: "b", weight: 40 }];
    expect(rubricJudgement(r, {})).toBeNull();
    expect(rubricJudgement(r, { a: 100 })).toBe(100);
    expect(rubricJudgement(r, { a: 100, b: 0 })).toBe(60);
  });
  it("describes metrics in plain language", () => {
    const rows = describeMetrics(boxes());
    expect(rows.find((r) => r.label === "Objects matched")?.note).toBe("2 of 5 reference objects unmatched");
    expect(rows.find((r) => r.label === "Mean yaw error")?.note).toContain("mean yaw error 14");
  });
});

describe("certification check", () => {
  const tasks = [
    { code: "T1", isRequiredForCertification: true, isPublished: true }, { code: "T2", isRequiredForCertification: true, isPublished: true },
    { code: "T3", isRequiredForCertification: false, isPublished: true }, { code: "T4", isRequiredForCertification: true, isPublished: false },
  ];
  it("defaults to published required tasks, or uses the configured list", () => {
    expect(requiredCodes({}, tasks)).toEqual(["T1", "T2"]);
    expect(requiredCodes({ requiredTaskCodes: [] }, tasks)).toEqual(["T1", "T2"]);
    expect(requiredCodes({ requiredTaskCodes: ["T3"] }, tasks)).toEqual(["T3"]);
  });
  it("is complete only when every required task is APPROVED", () => {
    expect(evaluateCertification(["T1", "T2"], { T1: "APPROVED", T2: "PENDING_REVIEW" })).toEqual({ required: 2, approved: 1, remaining: ["T2"], complete: false });
    expect(evaluateCertification(["T1", "T2"], { T1: "APPROVED", T2: "APPROVED" }).complete).toBe(true);
    expect(evaluateCertification([], {}).complete).toBe(false);
  });
});

describe("decision data and input schema", () => {
  it("round-trips {tags, rubric} and reads legacy arrays", () => {
    expect(parseDecisionData(packDecisionData({ tags: ["a"], rubric: { k: 50 } }))).toEqual({ tags: ["a"], rubric: { k: 50 } });
    expect(parseDecisionData(["x", "y"])).toEqual({ tags: ["x", "y"], rubric: {} });
    expect(parseDecisionData(null)).toEqual({ tags: [], rubric: {} });
  });
  it("requires score for approve and feedback + instructions for revision", () => {
    expect(decideSchema.safeParse({ decision: "APPROVE" }).success).toBe(false);
    expect(decideSchema.safeParse({ decision: "APPROVE", score: 101 }).success).toBe(false);
    expect(decideSchema.safeParse({ decision: "APPROVE", score: 90 }).success).toBe(true);
    expect(decideSchema.safeParse({ decision: "REQUEST_REVISION", feedback: "x" }).success).toBe(false);
    expect(decideSchema.safeParse({ decision: "REQUEST_REVISION", feedback: "x", correctionInstructions: " " }).success).toBe(false);
    expect(decideSchema.safeParse({ decision: "REQUEST_REVISION", feedback: "x", correctionInstructions: "y" }).success).toBe(true);
  });
});
