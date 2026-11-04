import { z } from "zod";

const rubric = z.record(z.string().max(80), z.number().min(0).max(100)).default({});

export const decideSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("APPROVE"),
    score: z.number().finite().min(0).max(100),
    feedback: z.string().trim().max(5000).default(""),
    rubric,
  }),
  z.object({
    decision: z.literal("REQUEST_REVISION"),
    errorTags: z.array(z.string().max(80)).max(30).default([]),
    feedback: z.string().trim().min(1, "Feedback is required").max(5000),
    correctionInstructions: z.string().trim().min(1, "Correction instructions are required").max(5000),
    rubric,
  }),
]);
export type DecideInput = z.infer<typeof decideSchema>;

export const assignSchema = z.object({
  submissionId: z.string().min(1).max(80),
  /** Omit (or send own id) to self-assign; ADMIN may name any staff user, or null to clear. */
  reviewerId: z.string().min(1).max(80).nullable().optional(),
});

const optId = z.string().max(80).optional().transform((v) => (v ? v : undefined));
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined));

export const queueFilterSchema = z.object({
  status: z.enum(["PENDING_REVIEW", "REVISION_REQUIRED", "APPROVED", "ALL"]).default("PENDING_REVIEW"),
  taskId: optId, traineeId: optId, programId: optId,
  mine: z.union([z.literal("1"), z.literal("on"), z.literal("true")]).optional().transform((v) => Boolean(v)),
  from: optDate, to: optDate,
});
export type QueueFilter = z.infer<typeof queueFilterSchema>;

export const historyFilterSchema = z.object({
  decision: z.enum(["APPROVE", "REQUEST_REVISION", "ALL"]).default("ALL"),
  taskId: optId, traineeId: optId, reviewerId: optId, from: optDate, to: optDate,
});
export type HistoryFilter = z.infer<typeof historyFilterSchema>;

export const notificationsReadSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().max(80)).min(1).max(100) }),
]);

export function dayRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const r: { gte?: Date; lte?: Date } = {};
  if (from) r.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) r.lte = new Date(`${to}T23:59:59.999Z`);
  return r;
}
