import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { recordHeartbeat } from "@/lib/learn/service";

const bodySchema = z.object({ moduleId: z.string().min(1).max(64).nullish() });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  let moduleId = parsed.data.moduleId ?? null;
  if (moduleId && !(await db.module.findUnique({ where: { id: moduleId }, select: { id: true } }))) moduleId = null;
  await recordHeartbeat(user.id, moduleId);
  return NextResponse.json({ ok: true });
}
