import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { recordCheckpoint } from "@/lib/learn/service";

const bodySchema = z.object({ lessonId: z.string().min(1).max(64), key: z.string().min(1).max(64) });

/** Tick one interactive lesson checkpoint for the signed-in user. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const r = await recordCheckpoint(user.id, user.role, parsed.data.lessonId, parsed.data.key);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: /locked|not available/i.test(r.error) ? 403 : 404 });
  return NextResponse.json({ ok: true, checkpoints: r.checkpoints });
}
