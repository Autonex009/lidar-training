import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { getTimeline } from "@/lib/admin/queries";
import { timelineToCsv } from "@/lib/admin/timeline";
import { activityTypes } from "@/lib/admin/filters";

export const runtime = "nodejs";

const query = z.object({
  types: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "REVIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sp = new URL(req.url).searchParams;
  const q = query.safeParse({ types: sp.getAll("types").join(","), from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const { types, from, to } = activityTypes(q.data);
  const csv = timelineToCsv(await getTimeline(id, { types, from, to }));
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="activity-${target.email.replace(/[^\w.@-]/g, "_")}.csv"`,
    },
  });
}
