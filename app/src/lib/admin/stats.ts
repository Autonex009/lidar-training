import type { AssignmentStatus } from "@prisma/client";

/** One row per trainee (for the selected/first enrollment). Pure input for dashboard + list buckets. */
export interface TraineeFacts {
  userId: string;
  registeredAt: Date;
  programId: string | null;
  learnCompletedAt: Date | null;
  programCompletedAt: Date | null;
  hasCertificate: boolean;
  modulesOpened: number;
  /** Final-assessment attempts, any order. */
  finalAttempts: { score: number; passed: boolean; finishedAt: Date }[];
  assignmentStatuses: AssignmentStatus[];
  /** Scores of APPROVE review decisions for this trainee. */
  approvedScores: number[];
}

export type StatusBucket =
  | "not_started" | "learning" | "assessment_failed" | "learn_completed" | "annotating" | "pending_review" | "revision_required" | "completed";

export const BUCKET_LABELS: Record<StatusBucket, string> = {
  not_started: "Not started", learning: "Learning", assessment_failed: "Assessment failed", learn_completed: "Learn completed",
  annotating: "Annotating", pending_review: "Pending review", revision_required: "Revision required", completed: "Completed",
};

export const latestFinal = (f: TraineeFacts) =>
  [...f.finalAttempts].sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime())[0] ?? null;

export const isAssessmentFailed = (f: TraineeFacts) => {
  const last = latestFinal(f);
  return Boolean(last && !last.passed && !f.finalAttempts.some((a) => a.passed));
};
export const isCompleted = (f: TraineeFacts) => Boolean(f.programCompletedAt) || f.hasCertificate;
const has = (f: TraineeFacts, ...s: AssignmentStatus[]) => f.assignmentStatuses.some((x) => s.includes(x));

/** Single primary bucket (priority order) for list filtering. */
export function bucketOf(f: TraineeFacts): StatusBucket {
  if (isCompleted(f)) return "completed";
  if (f.learnCompletedAt) {
    if (has(f, "REVISION_REQUIRED")) return "revision_required";
    if (has(f, "PENDING_REVIEW", "SUBMITTED")) return "pending_review";
    if (has(f, "IN_PROGRESS")) return "annotating";
    return "learn_completed";
  }
  if (isAssessmentFailed(f)) return "assessment_failed";
  if (f.modulesOpened > 0) return "learning";
  return "not_started";
}

export interface DashboardStats {
  totalTrainees: number;
  notStarted: number;
  learningInProgress: number;
  learningCompleted: number;
  assessmentFailed: number;
  annotationInProgress: number;
  pendingReview: number;
  revisionRequired: number;
  completed: number;
  avgAssessmentScore: number | null;
  avgTaskScore: number | null;
  /** Milliseconds, registration -> programCompletedAt, completed trainees only. */
  avgTimeToCompletionMs: number | null;
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Counts are per trainee and not mutually exclusive (e.g. a completed trainee is also "learning completed"). */
export function computeDashboardStats(rows: TraineeFacts[]): DashboardStats {
  const assess = rows.map(latestFinal).filter((x): x is NonNullable<typeof x> => x !== null).map((a) => a.score);
  const times = rows.filter((r) => r.programCompletedAt).map((r) => r.programCompletedAt!.getTime() - r.registeredAt.getTime());
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  return {
    totalTrainees: rows.length,
    notStarted: rows.filter((r) => r.modulesOpened === 0 && !r.learnCompletedAt).length,
    learningInProgress: rows.filter((r) => r.modulesOpened > 0 && !r.learnCompletedAt).length,
    learningCompleted: rows.filter((r) => r.learnCompletedAt).length,
    assessmentFailed: rows.filter(isAssessmentFailed).length,
    annotationInProgress: rows.filter((r) => has(r, "IN_PROGRESS")).length,
    pendingReview: rows.filter((r) => has(r, "PENDING_REVIEW", "SUBMITTED")).length,
    revisionRequired: rows.filter((r) => has(r, "REVISION_REQUIRED")).length,
    completed: rows.filter(isCompleted).length,
    avgAssessmentScore: mean(assess),
    avgTaskScore: mean(rows.flatMap((r) => r.approvedScores)),
    avgTimeToCompletionMs: avgTime,
  };
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "n/a";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
