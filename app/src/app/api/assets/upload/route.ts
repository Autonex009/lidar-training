import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { MAX_RENDER_POINTS, MAX_UPLOAD_POINTS, safeResolve } from "@/lib/assets-store";
import { BIN_PRESETS, PointCloudParseError, detectFormat, parsePointCloud, subsample, type RecordSchema } from "@/lib/pointcloud";
import { writeFrames } from "@/lib/pointcloud/cache-node";
import { validateRecordSchema } from "@/lib/pointcloud/parsers/bin";

export const runtime = "nodejs";

const fields = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  format: z.enum(["ply", "pcd", "xyz", "pts", "las", "laz", "bin"]).optional(),
  upAxis: z.enum(["Z", "Y"]).default("Z"),
  recordSchema: z.string().optional(), // JSON, or a preset name such as KITTI_XYZI
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "REVIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const parsed = fields.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  const f = parsed.data;
  const format = f.format ?? detectFormat(file.name);
  if (!format) return NextResponse.json({ error: "Cannot detect format from file name; pass 'format'" }, { status: 400 });

  let recordSchema: RecordSchema | undefined;
  try {
    if (f.recordSchema) recordSchema = BIN_PRESETS[f.recordSchema] ?? validateRecordSchema(JSON.parse(f.recordSchema));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid recordSchema" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let cloud;
  try {
    cloud = parsePointCloud(bytes, { format, recordSchema });
  } catch (e) {
    if (e instanceof PointCloudParseError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: `Failed to parse file: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }
  if (cloud.pointCount > MAX_UPLOAD_POINTS) {
    return NextResponse.json({ error: `Point cloud has ${cloud.pointCount} points; the limit is ${MAX_UPLOAD_POINTS}` }, { status: 400 });
  }

  const id = randomUUID();
  const safeName = path.basename(file.name).replace(/[^\w.\-]+/g, "_") || "upload";
  const sourceRel = path.join(id, "source", safeName);
  const srcFull = safeResolve(sourceRel);
  const cacheDir = safeResolve(id);
  if (!srcFull || !cacheDir) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  fs.mkdirSync(path.dirname(srcFull), { recursive: true });
  fs.writeFileSync(srcFull, bytes);

  const rendered = subsample({ ...cloud, upAxis: f.upAxis }, MAX_RENDER_POINTS, 1);
  writeFrames(cacheDir, [rendered]);

  const asset = await db.pointCloudAsset.create({
    data: {
      id, name: f.name ?? file.name, description: f.description ?? "", format, isSynthetic: false,
      sourcePath: sourceRel, cachePath: id, pointCount: rendered.pointCount, frameCount: 1, upAxis: f.upAxis,
      recordSchema: recordSchema ? (recordSchema as unknown as object) : undefined,
      metadata: JSON.parse(JSON.stringify({ originalPointCount: cloud.pointCount, subsampled: rendered.pointCount < cloud.pointCount, bounds: cloud.bounds, ...cloud.metadata })),
      createdById: user.id,
    },
  });
  return NextResponse.json({ id: asset.id, name: asset.name, pointCount: asset.pointCount, originalPointCount: cloud.pointCount }, { status: 201 });
}
