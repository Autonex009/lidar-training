import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { markNotificationsRead } from "@/lib/review/service";
import { notificationsReadSchema } from "@/lib/review/schemas";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = notificationsReadSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  return NextResponse.json({ updated: await markNotificationsRead(user.id, p.data) });
}
