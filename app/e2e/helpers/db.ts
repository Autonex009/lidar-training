/** Direct DB / service helpers for fixtures only. Assertions about behaviour go through the UI. */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// DATABASE_URL is set by playwright.config.ts before workers start.
export const db = new PrismaClient();

const CLI = path.resolve(__dirname, "fixtures-cli.ts");
/** Service-layer fixtures run in a tsx child process (resolves the app's "@/" aliases). */
function cli(...args: string[]) {
  return execFileSync("npx", ["tsx", CLI, ...args], { cwd: path.resolve(__dirname, "../.."), env: process.env, stdio: ["ignore", "pipe", "inherit"] }).toString();
}

/** Registers a trainee exactly like self-registration does (hash, enrol in default program, create assignments). */
export function createTrainee(u: { name: string; email: string; password: string }) {
  cli("create-trainee", u.name, u.email, u.password);
}

export const userByEmail = (email: string) => db.user.findUniqueOrThrow({ where: { email } });

type Answer = number | boolean;
const correct = (q: { correctAnswer: unknown }) => q.correctAnswer as Answer;

/** Answers that grade 100%, by question id. */
export async function correctAnswers(moduleId: string | null, programId: string): Promise<Record<string, Answer>> {
  const qs = await db.quizQuestion.findMany({ where: { programId, moduleId } });
  return Object.fromEntries(qs.map((q) => [q.id, correct(q)]));
}

/** Question ids in display order with the correct answer, for driving the quiz UI. */
export async function orderedQuestions(moduleId: string | null, programId: string) {
  const qs = await db.quizQuestion.findMany({ where: { programId, moduleId }, orderBy: { order: "asc" } });
  return qs.map((q) => ({ id: q.id, kind: q.kind, correct: correct(q), optionCount: Array.isArray(q.options) ? q.options.length : 0 }));
}

export async function programOf(userId: string) {
  return (await db.enrollment.findFirstOrThrow({ where: { userId }, orderBy: { enrolledAt: "asc" } })).programId;
}

export async function mandatoryModules(programId: string) {
  return db.module.findMany({ where: { programId, isMandatory: true }, orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } });
}

/** Completes every mandatory lesson and passes every module quiz through the real service functions (not the UI). */
export function completeMandatoryModules(userId: string) {
  cli("complete-mandatory", userId);
}

/** Marks the earlier tasks approved so TASK-03 is unlocked for the trainee (prerequisite chain). */
export async function approvePrerequisites(userId: string, codes = ["TASK-01", "TASK-02"]) {
  for (const code of codes) await db.taskAssignment.updateMany({ where: { userId, task: { code } }, data: { status: "APPROVED" } });
}

export async function assignmentFor(userId: string, code: string) {
  return db.taskAssignment.findFirstOrThrow({ where: { userId, task: { code } } });
}
