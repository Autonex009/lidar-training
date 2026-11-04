export interface Box {
  /** Centre xyz (z = vertical centre). */
  center: [number, number, number];
  /** [length (along heading), width, height]. */
  dims: [number, number, number];
  /** Yaw radians about the up axis (CCW). */
  yaw: number;
}

type P = [number, number];

/** Footprint corners (CCW) of the box in the ground plane. */
export function footprint(b: Box): P[] {
  const [cx, cy] = b.center;
  const hl = b.dims[0] / 2, hw = b.dims[1] / 2;
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return ([[hl, hw], [-hl, hw], [-hl, -hw], [hl, -hw]] as P[]).map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c] as P);
}

function polyArea(p: P[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Sutherland-Hodgman clip of a polygon by a convex CCW clip polygon. */
export function clipConvex(subject: P[], clip: P[]): P[] {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p: P) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const cross = (p: P, q: P): P => {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const t = (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) / (ex * dy - ey * dx);
      return [p[0] + t * dx, p[1] + t * dy];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    }
  }
  return out;
}

export function volume(b: Box): number {
  return Math.max(0, b.dims[0]) * Math.max(0, b.dims[1]) * Math.max(0, b.dims[2]);
}

/** Exact 3D IoU for boxes that rotate only about the vertical axis (polygon clipping x vertical overlap). */
export function iou3d(a: Box, b: Box): number {
  const va = volume(a), vb = volume(b);
  if (va <= 0 || vb <= 0) return 0;
  const zLo = Math.max(a.center[2] - a.dims[2] / 2, b.center[2] - b.dims[2] / 2);
  const zHi = Math.min(a.center[2] + a.dims[2] / 2, b.center[2] + b.dims[2] / 2);
  const dz = zHi - zLo;
  if (dz <= 0) return 0;
  const poly = clipConvex(footprint(a), footprint(b));
  if (poly.length < 3) return 0;
  const inter = polyArea(poly) * dz;
  return inter / (va + vb - inter);
}
