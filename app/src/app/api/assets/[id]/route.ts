import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const a = await db.pointCloudAsset.findUnique({ where: { id } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: a.id, name: a.name, description: a.description, format: a.format, isSynthetic: a.isSynthetic,
    pointCount: a.pointCount, frameCount: a.frameCount, upAxis: a.upAxis, metadata: a.metadata, createdAt: a.createdAt,
  });
}
