import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { assignReviewer } from "@/lib/review/service";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const r = await assignReviewer(user, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ reviewerId: r.reviewerId });
}
