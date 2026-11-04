import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { decideSubmission } from "@/lib/review/service";

export async function POST(req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { submissionId } = await params;
  const body = await req.json().catch(() => null);
  const r = await decideSubmission(user, submissionId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ decisionId: r.decisionId, status: r.status, programCompleted: r.programCompleted });
}
