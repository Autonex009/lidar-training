import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type Client = Pick<PrismaClient, "taskAssignment" | "taskTemplate" | "enrollment">;

/** Create NOT_STARTED assignments for every published task of the program the user lacks. Idempotent. Returns created count. */
export async function ensureAssignments(userId: string, programId: string, client: Client = db): Promise<number> {
  const tasks = await client.taskTemplate.findMany({ where: { programId, isPublished: true }, select: { id: true } });
  if (!tasks.length) return 0;
  const have = await client.taskAssignment.findMany({ where: { userId, taskId: { in: tasks.map((t) => t.id) } }, select: { taskId: true } });
  const haveSet = new Set(have.map((h) => h.taskId));
  const missing = tasks.filter((t) => !haveSet.has(t.id));
  if (!missing.length) return 0;
  await client.taskAssignment.createMany({ data: missing.map((t) => ({ taskId: t.id, userId })) });
  return missing.length;
}

export async function ensureAssignmentsForProgram(client: Client, programId: string): Promise<void> {
  const enrollments = await client.enrollment.findMany({ where: { programId }, select: { userId: true } });
  for (const e of enrollments) await ensureAssignments(e.userId, programId, client);
}
