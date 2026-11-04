import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listNotifications } from "@/lib/review/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listNotifications(user.id, 10));
}
