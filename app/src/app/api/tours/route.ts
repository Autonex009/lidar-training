import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listTours } from "@/lib/tour/service";

export const dynamic = "force-dynamic";

/** The caller's own tour statuses. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tours: await listTours(user.id) });
}
