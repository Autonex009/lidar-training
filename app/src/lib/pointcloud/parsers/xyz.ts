import { PointCloudParseError, type NormalizedCloud } from "../types";
import { PointBuilder, asciiSlice } from "./common";

/**
 * XYZ / PTS text. Columns by count: 3 = xyz, 4 = xyz+i, 6 = xyz+rgb, 7 = xyz+i+rgb (PTS).
 * Lines starting with a non-numeric token (headers, comments) and single-token count lines are skipped.
 */
export function parseXyz(u8: Uint8Array): NormalizedCloud {
  const text = asciiSlice(u8, 0, u8.length);
  const lines = text.split(/\r?\n/);
  let cols = 0;
  let b: PointBuilder | undefined;
  let hasI = false, hasRgb = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const c0 = line.charCodeAt(0);
    const numericStart = (c0 >= 48 && c0 <= 57) || c0 === 45 || c0 === 43 || c0 === 46;
    if (!numericStart) continue;
    const t = line.split(/[\s,;]+/);
    if (t.length < 3) continue;
    if (!b) {
      cols = t.length;
      hasI = cols === 4 || cols === 7 || (cols > 7 && cols !== 6);
      hasRgb = cols >= 6;
      b = new PointBuilder(hasRgb, hasI, 4096);
    }
    if (t.length < cols) continue;
    const v = t.map(Number);
    let i = 0, r = 0, g = 0, bl = 0;
    if (cols === 4) i = v[3];
    else if (cols === 6) { r = v[3]; g = v[4]; bl = v[5]; }
    else if (cols >= 7) { i = v[3]; r = v[4]; g = v[5]; bl = v[6]; }
    b.push(v[0], v[1], v[2], i, r, g, bl);
  }
  if (!b) throw new PointCloudParseError("XYZ: no numeric point rows found");
  return b.finish("Z", { source: "xyz", columns: cols });
}
