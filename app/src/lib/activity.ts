import type { ActivityType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function logActivity(
  userId: string,
  type: ActivityType,
  extra?: { entityType?: string; entityId?: string; metadata?: Prisma.InputJsonValue },
) {
  await db.activityLog.create({ data: { userId, type, ...extra } });
  await db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } }).catch(() => undefined);
}
