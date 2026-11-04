import { db } from "@/lib/db";

/** Pure: completed mandatory modules (+ final assessment) over total, as 0-100. */
export function computeProgressPercent(mandatoryTotal: number, mandatoryDone: number, finalPassed: boolean): number {
  const total = mandatoryTotal + 1;
  return Math.round(((mandatoryDone + (finalPassed ? 1 : 0)) / total) * 100);
}

/** Learning progress % = completed mandatory modules (+ final assessment) / (mandatory modules + final). */
export async function getLearningProgressPercent(userId: string): Promise<number> {
  const enrollment = await db.enrollment.findFirst({ where: { userId }, orderBy: { enrolledAt: "asc" } });
  if (!enrollment) return 0;
  const mandatoryTotal = await db.module.count({ where: { programId: enrollment.programId, isMandatory: true } });
  if (mandatoryTotal === 0) return 0;
  const done = await db.moduleProgress.count({
    where: { userId, completedAt: { not: null }, module: { programId: enrollment.programId, isMandatory: true } },
  });
  return computeProgressPercent(mandatoryTotal, done, Boolean(enrollment.learnCompletedAt));
}
