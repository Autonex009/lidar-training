import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { saveTour, tourKeySchema, tourSaveSchema } from "@/lib/tour/service";

export const dynamic = "force-dynamic";

/** Save the caller's own progress for one tour. The user id always comes from the session. */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = tourKeySchema.safeParse((await ctx.params).key);
  const body = tourSaveSchema.safeParse(await req.json().catch(() => null));
  if (!key.success || !body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  return NextResponse.json(await saveTour(user.id, key.data, body.data));
}
