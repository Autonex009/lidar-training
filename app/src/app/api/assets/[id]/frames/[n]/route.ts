import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { safeResolve } from "@/lib/assets-store";
import { frameFileName } from "@/lib/pointcloud/cache";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, n } = await params;
  if (!/^\d{1,4}$/.test(n)) return NextResponse.json({ error: "Bad frame index" }, { status: 400 });
  const a = await db.pointCloudAsset.findUnique({ where: { id }, select: { cachePath: true, frameCount: true } });
  if (!a?.cachePath) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const idx = Number(n);
  if (idx >= a.frameCount) return NextResponse.json({ error: "Frame out of range" }, { status: 404 });
  const file = safeResolve(path.join(a.cachePath, frameFileName(idx)));
  if (!file) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  let data: Buffer;
  try {
    data = await fs.promises.readFile(file);
  } catch {
    return NextResponse.json({ error: "Cache file missing; run assets:generate" }, { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=3600, immutable",
    },
  });
}
