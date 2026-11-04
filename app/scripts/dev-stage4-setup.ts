/**
 * Dev utility (Stage 4): creates/updates a trainee whose Learn gate is already passed so the Annotate stage can be
 * exercised without clicking through the curriculum. TASK-01/02 are marked APPROVED so TASK-03 is unlocked.
 *
 *   npx tsx scripts/dev-stage4-setup.ts [email] [password]
 *
 * Idempotent. Never use against a real database: it writes a known password.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureAssignments } from "../src/lib/tasks/assignments";

const email = (process.argv[2] ?? "stage4.trainee@example.com").toLowerCase();
const password = process.argv[3] ?? "Stage4-demo-pass";
const db = new PrismaClient();

async function main() {
  const program = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "foundations" } });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.upsert({ where: { email }, create: { email, name: "Stage4 Trainee", passwordHash, role: "TRAINEE" }, update: { passwordHash } });
  await db.enrollment.upsert({ where: { userId_programId: { userId: user.id, programId: program.id } }, create: { userId: user.id, programId: program.id, learnCompletedAt: new Date() }, update: { learnCompletedAt: new Date() } });
  await ensureAssignments(user.id, program.id, db);
  for (const code of ["TASK-01", "TASK-02"]) {
    await db.taskAssignment.updateMany({ where: { userId: user.id, task: { code } }, data: { status: "APPROVED" } });
  }
  // fresh start for TASK-03 so the verification run is repeatable
  const t3 = await db.taskAssignment.findFirst({ where: { userId: user.id, task: { code: "TASK-03" } } });
  if (t3) {
    await db.annotationDraft.deleteMany({ where: { assignmentId: t3.id } });
    await db.submission.deleteMany({ where: { assignmentId: t3.id } });
    await db.submissionVersion.deleteMany({ where: { assignmentId: t3.id } });
    await db.taskAssignment.update({ where: { id: t3.id }, data: { status: "NOT_STARTED" } });
  }
  console.log(JSON.stringify({ email, password, userId: user.id }));
}

main().finally(() => db.$disconnect());
