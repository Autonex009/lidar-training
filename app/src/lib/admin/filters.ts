import type { ActivityType } from "@prisma/client";

export const ACTIVITY_TYPES: ActivityType[] = [
  "LOGIN", "LOGOUT", "MODULE_OPENED", "LESSON_COMPLETED", "MODULE_COMPLETED", "QUIZ_ATTEMPTED", "ASSESSMENT_ATTEMPTED", "LEARN_COMPLETED",
  "TASK_OPENED", "ANNOTATION_STARTED", "DRAFT_SAVED", "TASK_SUBMITTED", "REVISION_REQUESTED", "REVISION_SUBMITTED", "TASK_APPROVED", "PROGRAM_COMPLETED",
  "TOUR_STARTED", "TOUR_COMPLETED", "TOUR_SKIPPED",
];

export function parseDate(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Parse ?types=A,B&from=YYYY-MM-DD&to=YYYY-MM-DD into a timeline filter. */
export function activityTypes(q: { types?: string; from?: string; to?: string }) {
  const types = (q.types ?? "").split(",").filter((t): t is ActivityType => (ACTIVITY_TYPES as string[]).includes(t));
  return { types: types.length ? types : undefined, from: parseDate(q.from), to: parseDate(q.to, true) };
}
