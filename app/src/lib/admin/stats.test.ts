import { describe, expect, it } from "vitest";
import { bucketOf, computeDashboardStats, formatDuration, type TraineeFacts } from "./stats";
import { buildTimeline, timelineToCsv } from "./timeline";

const d = (s: string) => new Date(s);
const base = (over: Partial<TraineeFacts>): TraineeFacts => ({
  userId: "u", registeredAt: d("2026-01-01T00:00:00Z"), programId: "p", learnCompletedAt: null, programCompletedAt: null, hasCertificate: false,
  modulesOpened: 0, finalAttempts: [], assignmentStatuses: [], approvedScores: [], ...over,
});

const rows: TraineeFacts[] = [
  base({ userId: "a" }), // not started
  base({ userId: "b", modulesOpened: 2 }), // learning
  base({ userId: "c", modulesOpened: 6, finalAttempts: [{ score: 60, passed: false, finishedAt: d("2026-01-05T00:00:00Z") }] }), // assessment failed
  base({ userId: "d", modulesOpened: 6, finalAttempts: [{ score: 50, passed: false, finishedAt: d("2026-01-02T00:00:00Z") }, { score: 90, passed: true, finishedAt: d("2026-01-03T00:00:00Z") }], learnCompletedAt: d("2026-01-03T00:00:00Z"), assignmentStatuses: ["IN_PROGRESS", "NOT_STARTED"] }), // annotating
  base({ userId: "e", modulesOpened: 6, finalAttempts: [{ score: 80, passed: true, finishedAt: d("2026-01-03T00:00:00Z") }], learnCompletedAt: d("2026-01-03T00:00:00Z"), assignmentStatuses: ["PENDING_REVIEW", "APPROVED"], approvedScores: [70] }), // pending review
  base({ userId: "f", modulesOpened: 6, finalAttempts: [{ score: 100, passed: true, finishedAt: d("2026-01-03T00:00:00Z") }], learnCompletedAt: d("2026-01-03T00:00:00Z"), assignmentStatuses: ["REVISION_REQUIRED"] }), // revision
  base({ userId: "g", modulesOpened: 6, finalAttempts: [{ score: 90, passed: true, finishedAt: d("2026-01-03T00:00:00Z") }], learnCompletedAt: d("2026-01-03T00:00:00Z"), programCompletedAt: d("2026-01-11T00:00:00Z"), hasCertificate: true, assignmentStatuses: ["APPROVED"], approvedScores: [90, 80] }), // completed in 10 days
];

describe("computeDashboardStats", () => {
  it("counts each state from fixture rows", () => {
    const s = computeDashboardStats(rows);
    expect(s.totalTrainees).toBe(7);
    expect(s.notStarted).toBe(1);
    expect(s.learningInProgress).toBe(2); // b and c
    expect(s.learningCompleted).toBe(4); // d e f g
    expect(s.assessmentFailed).toBe(1); // c only: d later passed
    expect(s.annotationInProgress).toBe(1);
    expect(s.pendingReview).toBe(1);
    expect(s.revisionRequired).toBe(1);
    expect(s.completed).toBe(1);
  });

  it("averages assessment (latest attempt), task score (approved) and time to completion", () => {
    const s = computeDashboardStats(rows);
    // latest attempts: c 60, d 90, e 80, f 100, g 90 -> 84
    expect(s.avgAssessmentScore).toBe(84);
    expect(s.avgTaskScore).toBe(80); // (70+90+80)/3
    expect(s.avgTimeToCompletionMs).toBe(10 * 86_400_000);
    expect(formatDuration(s.avgTimeToCompletionMs)).toBe("10.0 days");
  });

  it("returns nulls on an empty set", () => {
    const s = computeDashboardStats([]);
    expect(s.totalTrainees).toBe(0);
    expect(s.avgAssessmentScore).toBeNull();
    expect(s.avgTaskScore).toBeNull();
    expect(s.avgTimeToCompletionMs).toBeNull();
  });
});

describe("bucketOf", () => {
  it("assigns one primary bucket in priority order", () => {
    expect(rows.map(bucketOf)).toEqual(["not_started", "learning", "assessment_failed", "annotating", "pending_review", "revision_required", "completed"]);
  });
});

describe("timeline csv", () => {
  it("escapes commas, quotes and newlines", () => {
    const ev = buildTimeline(
      [{ id: "1", type: "TASK_SUBMITTED", entityType: "TaskAssignment", entityId: "x", metadata: { note: 'a "b", c' }, createdAt: d("2026-01-01T10:00:00Z") }],
      new Map([["x", 'TASK-01 "Nav", basic']]),
    );
    const csv = timelineToCsv(ev);
    const [head, line] = csv.trim().split("\r\n");
    expect(head).toBe("timestamp,type,entityType,entityId,entity,detail,metadata");
    expect(line).toContain('"TASK-01 ""Nav"", basic"');
    expect(line.startsWith("2026-01-01T10:00:00.000Z,TASK_SUBMITTED")).toBe(true);
  });
});
