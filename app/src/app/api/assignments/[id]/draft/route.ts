import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { saveDraft } from "@/lib/tasks/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const data = (body as { data?: unknown } | null)?.data;
  const r = await saveDraft(user, id, data);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ savedAt: r.savedAt, status: r.status });
}
