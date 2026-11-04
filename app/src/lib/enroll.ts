import { db } from "@/lib/db";

/** Enroll the user in the active program, if one exists. Idempotent. */
export async function enrollInActiveProgram(userId: string): Promise<boolean> {
  const program = await db.trainingProgram.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!program) return false;
  await db.enrollment.upsert({
    where: { userId_programId: { userId, programId: program.id } },
    create: { userId, programId: program.id },
    update: {},
  });
  return true;
}
