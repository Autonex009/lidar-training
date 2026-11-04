import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { projectConfigsRoot } from "@/lib/project-config";

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, file } = await params;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug) || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(file) || file.includes("..")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  const dir = path.resolve(projectConfigsRoot(), slug, "images");
  const full = path.resolve(dir, file);
  if (!full.startsWith(dir + path.sep) || !fs.existsSync(full)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(fs.readFileSync(full)), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
}
