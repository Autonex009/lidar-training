import path from "node:path";

export const MAX_UPLOAD_POINTS = 5_000_000;
export const MAX_RENDER_POINTS = 1_000_000;

/** Point-cloud cache root. Defaults to <app>/data/assets; override with ASSETS_DIR (e.g. a mounted volume). */
export function assetsRoot(): string {
  return process.env.ASSETS_DIR ? path.resolve(process.env.ASSETS_DIR) : path.join(process.cwd(), "data", "assets");
}

/** Resolves a path relative to data/assets; returns null if it escapes the root. */
export function safeResolve(rel: string): string | null {
  if (!rel || rel.includes("\0") || path.isAbsolute(rel)) return null;
  const root = assetsRoot();
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}
