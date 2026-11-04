import { db } from "@/lib/db";

export const defaultProgramSlug = () => process.env.DEFAULT_PROGRAM_SLUG?.trim() || "foundations";

/** Enroll the user in the default program (env DEFAULT_PROGRAM_SLUG, default "foundations"). Idempotent. */
export async function enrollInActiveProgram(userId: string): Promise<boolean> {
  const program =
    (await db.trainingProgram.findFirst({ where: { slug: defaultProgramSlug(), isActive: true } })) ??
    (await db.trainingProgram.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
  if (!program) return false;
  await db.enrollment.upsert({
    where: { userId_programId: { userId, programId: program.id } },
    create: { userId, programId: program.id },
    update: {},
  });
  return true;
}

/** The user's (first) enrollment with its program; enrolls in the default program when missing. */
export async function getUserEnrollment(userId: string) {
  const find = () => db.enrollment.findFirst({ where: { userId }, orderBy: { enrolledAt: "asc" }, include: { program: true } });
  let e = await find();
  if (!e && (await enrollInActiveProgram(userId))) e = await find();
  return e;
}
