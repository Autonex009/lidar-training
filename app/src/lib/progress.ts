import { db } from "@/lib/db";

/** Percentage (0-100) of lessons completed in the active program. 0 when no content yet. */
export async function getLearningProgressPercent(userId: string): Promise<number> {
  const program = await db.trainingProgram.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!program) return 0;
  const total = await db.lesson.count({ where: { module: { programId: program.id } } });
  if (total === 0) return 0;
  const done = await db.lessonProgress.count({
    where: { userId, lesson: { module: { programId: program.id } } },
  });
  return Math.round((done / total) * 100);
}
