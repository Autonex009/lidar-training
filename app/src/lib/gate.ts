import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

export type GatedSection = "annotate" | "review" | "complete";

export interface GateState {
  learnComplete: boolean;
  unlocked: { annotate: boolean; review: boolean; complete: boolean };
  reasons: string[];
}

export const LOCK_REASON =
  "Complete all mandatory Learn modules (lessons and quizzes) and pass the final assessment to unlock this section.";

/** Pure: derive gate state from whether Learn is complete. */
export function computeGateState(learnComplete: boolean): GateState {
  return {
    learnComplete,
    unlocked: { annotate: learnComplete, review: learnComplete, complete: learnComplete },
    reasons: learnComplete ? [] : [LOCK_REASON],
  };
}

/** Staff (reviewer/admin) bypass the learning gate. */
export function computeGateForRole(role: Role, learnComplete: boolean): GateState {
  if (role === "REVIEWER" || role === "ADMIN") {
    return { learnComplete: true, unlocked: { annotate: true, review: true, complete: true }, reasons: [] };
  }
  return computeGateState(learnComplete);
}

export async function getTraineeGateState(userId: string): Promise<GateState> {
  const program = await db.trainingProgram.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!program) return computeGateState(false);
  const enrollment = await db.enrollment.findUnique({
    where: { userId_programId: { userId, programId: program.id } },
  });
  return computeGateState(Boolean(enrollment?.learnCompletedAt));
}

export async function getGateStateForUser(userId: string, role: Role): Promise<GateState> {
  if (role !== "TRAINEE") return computeGateForRole(role, true);
  return getTraineeGateState(userId);
}
