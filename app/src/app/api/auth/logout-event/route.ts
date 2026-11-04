import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await logActivity(user.id, "LOGOUT");
  return NextResponse.json({ ok: true });
}
