"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { completeLesson, submitFinalAssessment, submitModuleQuiz, type ActionResult, type QuizOutcome } from "@/lib/learn/service";

const answersSchema = z.record(z.string().max(64), z.union([z.number().int().min(0).max(20), z.boolean(), z.null()]));

function refresh() {
  revalidatePath("/", "layout");
}

export async function completeLessonAction(input: { lessonId: string }): Promise<ActionResult<{ moduleCompleted: boolean }>> {
  const parsed = z.object({ lessonId: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const r = await completeLesson(user.id, user.role, parsed.data.lessonId);
  refresh();
  return r;
}

export async function submitQuizAction(input: { moduleId: string; answers: Record<string, number | boolean | null> }): Promise<ActionResult<{ outcome: QuizOutcome }>> {
  const parsed = z.object({ moduleId: z.string().min(1).max(64), answers: answersSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const r = await submitModuleQuiz(user.id, user.role, parsed.data.moduleId, parsed.data.answers);
  refresh();
  return r;
}

export async function submitFinalAction(input: { answers: Record<string, number | boolean | null> }): Promise<ActionResult<{ outcome: QuizOutcome }>> {
  const parsed = z.object({ answers: answersSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const r = await submitFinalAssessment(user.id, user.role, parsed.data.answers);
  refresh();
  return r;
}
