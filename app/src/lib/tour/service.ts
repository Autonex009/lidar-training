import { z } from "zod";
import type { TourStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const tourKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export const tourSaveSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"]),
  lastStepIndex: z.number().int().min(0).max(200),
});
export type TourSave = z.infer<typeof tourSaveSchema>;

export async function listTours(userId: string) {
  const rows = await db.tourProgress.findMany({ where: { userId }, select: { tourKey: true, status: true, lastStepIndex: true, completedAt: true, updatedAt: true } });
  return rows.map((r) => ({ ...r, completedAt: r.completedAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString() }));
}

/** Upsert the caller's own progress and log TOUR_STARTED / TOUR_COMPLETED / TOUR_SKIPPED on transitions. */
export async function saveTour(userId: string, tourKey: string, input: TourSave) {
  const prev = await db.tourProgress.findUnique({ where: { userId_tourKey: { userId, tourKey } } });
  const completedAt = input.status === "COMPLETED" ? prev?.completedAt ?? new Date() : input.status === "NOT_STARTED" ? null : prev?.completedAt ?? null;
  const row = await db.tourProgress.upsert({
    where: { userId_tourKey: { userId, tourKey } },
    create: { userId, tourKey, status: input.status, lastStepIndex: input.lastStepIndex, completedAt },
    update: { status: input.status, lastStepIndex: input.lastStepIndex, completedAt },
  });
  const before: TourStatus = prev?.status ?? "NOT_STARTED";
  const type = input.status === "COMPLETED" && before !== "COMPLETED" ? "TOUR_COMPLETED"
    : input.status === "SKIPPED" && before !== "SKIPPED" ? "TOUR_SKIPPED"
    : input.status === "IN_PROGRESS" && (before === "NOT_STARTED" || before === "COMPLETED" || before === "SKIPPED") ? "TOUR_STARTED"
    : null;
  if (type) await logActivity(userId, type, { entityType: "Tour", entityId: tourKey, metadata: { tourKey, lastStepIndex: input.lastStepIndex } });
  return { tourKey: row.tourKey, status: row.status, lastStepIndex: row.lastStepIndex };
}
