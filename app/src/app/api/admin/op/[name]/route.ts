import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { runOp } from "@/lib/admin/ops";

export const runtime = "nodejs";

/** Single admin mutation endpoint: POST { ...input } -> { ok, data } | { ok:false, error }. Auth + role checked per operation. */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getSessionUser();
  const { name } = await params;
  let body: unknown = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Expected JSON body" }, { status: user ? 400 : 401 }); }
  const res = await runOp(name, user, body);
  return res.ok ? NextResponse.json(res) : NextResponse.json(res, { status: res.status });
}
