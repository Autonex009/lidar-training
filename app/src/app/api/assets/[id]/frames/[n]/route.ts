import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { safeResolve } from "@/lib/assets-store";
import { frameFileName, frameNoLabelsFileName, stripLabelsFromCache } from "@/lib/pointcloud/cache";

const STAFF = new Set(["REVIEWER", "ADMIN"]);

/**
 * Serves a normalized frame cache. Per-point reference labels (synthetic ground truth) are only
 * included for staff (REVIEWER/ADMIN) who explicitly ask with ?withLabels=1. Everyone else gets a
 * lazily generated `frame_NNN.nolabels.bin` copy with the labels removed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, n } = await params;
  if (!/^\d{1,4}$/.test(n)) return NextResponse.json({ error: "Bad frame index" }, { status: 400 });
  const a = await db.pointCloudAsset.findUnique({ where: { id }, select: { cachePath: true, frameCount: true } });
  if (!a?.cachePath) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const idx = Number(n);
  if (idx >= a.frameCount) return NextResponse.json({ error: "Frame out of range" }, { status: 404 });
  const wantLabels = new URL(req.url).searchParams.get("withLabels") === "1" && STAFF.has(user.role);
  const original = safeResolve(path.join(a.cachePath, frameFileName(idx)));
  const stripped = safeResolve(path.join(a.cachePath, frameNoLabelsFileName(idx)));
  if (!original || !stripped) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  let data: Buffer | Uint8Array;
  try {
    if (wantLabels) {
      data = await fs.promises.readFile(original);
    } else {
      try {
        // Reuse the stripped copy only if it is at least as new as the original (assets:generate may rewrite it).
        const [so, ss] = await Promise.all([fs.promises.stat(original), fs.promises.stat(stripped)]);
        if (ss.mtimeMs < so.mtimeMs) throw new Error("stale");
        data = await fs.promises.readFile(stripped);
      } catch {
        const full = await fs.promises.readFile(original);
        data = stripLabelsFromCache(full);
        const tmp = `${stripped}.${process.pid}.tmp`;
        await fs.promises.writeFile(tmp, data);
        await fs.promises.rename(tmp, stripped);
      }
    }
  } catch {
    return NextResponse.json({ error: "Cache file missing; run assets:generate" }, { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}
