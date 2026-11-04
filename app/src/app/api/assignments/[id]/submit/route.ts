import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { submitAssignment } from "@/lib/tasks/service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await submitAssignment(user, id);
  if (!r.ok) return NextResponse.json({ error: r.error, issues: r.issues }, { status: r.status });
  return NextResponse.json({ versionNumber: r.versionNumber, attemptNumber: r.attemptNumber, warnings: r.warnings });
}
