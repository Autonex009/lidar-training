/**
 * Dev utility (Stage 5): creates/resets a trainee (Learn gate passed, TASK-01/02 approved) with TASK-03 submitted and
 * pending review, plus a reviewer. Repeatable. Never use against a real database (known passwords).
 *
 *   npx tsx scripts/dev-stage5-setup.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureAssignments } from "../src/lib/tasks/assignments";
import { saveDraft, submitAssignment } from "../src/lib/tasks/service";

const db = new PrismaClient();
const TRAINEE = { email: "stage5.trainee@example.com", password: "Stage5-demo-pass", name: "Stage5 Trainee" };
const REVIEWER = { email: "stage5.reviewer@example.com", password: "Stage5-demo-pass", name: "Stage5 Reviewer" };

async function user(u: { email: string; password: string; name: string }, role: "TRAINEE" | "REVIEWER") {
  const passwordHash = await bcrypt.hash(u.password, 10);
  return db.user.upsert({ where: { email: u.email }, create: { email: u.email, name: u.name, passwordHash, role }, update: { passwordHash, role, name: u.name } });
}

async function main() {
  const program = await db.trainingProgram.findUniqueOrThrow({ where: { slug: "foundations" } });
  const t = await user(TRAINEE, "TRAINEE");
  const r = await user(REVIEWER, "REVIEWER");
  await db.enrollment.upsert({ where: { userId_programId: { userId: t.id, programId: program.id } }, create: { userId: t.id, programId: program.id, learnCompletedAt: new Date() }, update: { learnCompletedAt: new Date(), programCompletedAt: null } });
  await db.certificate.deleteMany({ where: { userId: t.id } });
  await db.notification.deleteMany({ where: { userId: { in: [t.id, r.id] } } });
  await ensureAssignments(t.id, program.id, db);
  await db.taskAssignment.updateMany({ where: { userId: t.id }, data: { status: "NOT_STARTED", reviewerId: null } });
  await db.submission.deleteMany({ where: { userId: t.id } });
  await db.submissionVersion.deleteMany({ where: { assignment: { userId: t.id } } });
  await db.annotationDraft.deleteMany({ where: { assignment: { userId: t.id } } });
  for (const code of ["TASK-01", "TASK-02"]) await db.taskAssignment.updateMany({ where: { userId: t.id, task: { code } }, data: { status: "APPROVED" } });

  const a3 = await db.taskAssignment.findFirstOrThrow({ where: { userId: t.id, task: { code: "TASK-03" } } });
  const box = (id: string, label: string, c: [number, number, number], d: [number, number, number], yaw: number) => ({ id, label, center: c, dims: d, yaw, attributes: {} });
  // one decent car box and one deliberately loose pedestrian-class box so metrics show something to discuss
  const doc = { version: 1, frames: { "0": { cuboids: [box("c1", "Vehicle", [9, 5, 0.75], [4.5, 1.9, 1.5], 0.35), box("c2", "Pedestrian", [3, -4, 0.9], [1.2, 1.2, 1.9], 0)] } }, flags: [{ id: "f1", cuboidId: "c2", reason: "Sparse points, unsure of class" }], answers: {}, checkpoints: {} };
  const actor = { id: t.id, role: "TRAINEE" as const, name: t.name };
  const sd = await saveDraft(actor, a3.id, doc);
  if (!sd.ok) throw new Error(`saveDraft: ${sd.error}`);
  const sub = await submitAssignment(actor, a3.id);
  if (!sub.ok) throw new Error(`submit: ${sub.error} ${JSON.stringify(sub.issues)}`);
  const submission = await db.submission.findFirstOrThrow({ where: { assignmentId: a3.id } });
  console.log(JSON.stringify({ trainee: TRAINEE, reviewer: REVIEWER, assignmentId: a3.id, submissionId: submission.id }));
}

main().finally(() => db.$disconnect());
