import type { Vec3 } from "./types";

export interface FitInput { center: Vec3; dims: Vec3; yaw: number }
export interface FitOptions {
  /** Footprint expansion when collecting points (m). */
  margin?: number;
  /** Ground level (data-frame up value). Points within `groundBand` of it are ignored. */
  groundZ: number;
  groundBand?: number;
  /** Vertical slack above the current box top when collecting points (m). */
  headroom?: number;
  /** Minimum number of object points required. */
  minPoints?: number;
}
export interface FitResult { center: Vec3; dims: Vec3; pointCount: number }

/**
 * Snap a (Z-up) box to the points inside its footprint +/- margin. Yaw is kept. Returns null when
 * too few non-ground points are found. Extents use a 1% trim when there are enough points so a
 * single stray return does not inflate the box.
 */
export function fitCuboidToPoints(positions: Float32Array, box: FitInput, opts: FitOptions): FitResult | null {
  const margin = opts.margin ?? 0.3;
  const band = opts.groundBand ?? 0.15;
  const head = opts.headroom ?? 0.5;
  const minPts = opts.minPoints ?? 8;
  const c = Math.cos(box.yaw), s = Math.sin(box.yaw);
  const hl = box.dims[0] / 2 + margin, hw = box.dims[1] / 2 + margin;
  const zTop = box.center[2] + box.dims[2] / 2 + head;
  const us: number[] = [], vs: number[] = [], zs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - box.center[0], dy = positions[i + 1] - box.center[1], z = positions[i + 2];
    if (z < opts.groundZ + band || z > zTop) continue;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (Math.abs(u) > hl || Math.abs(v) > hw) continue;
    us.push(u); vs.push(v); zs.push(z);
  }
  if (us.length < minPts) return null;
  const range = (a: number[]): [number, number] => {
    const sorted = [...a].sort((x, y) => x - y);
    const trim = sorted.length >= 100 ? Math.floor(sorted.length * 0.01) : 0;
    return [sorted[trim], sorted[sorted.length - 1 - trim]];
  };
  const [u0, u1] = range(us), [v0, v1] = range(vs), [z0, z1] = range(zs);
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const base = z0 < opts.groundZ + 0.5 ? opts.groundZ : z0;
  const dims: Vec3 = [Math.max(0.1, u1 - u0), Math.max(0.1, v1 - v0), Math.max(0.1, z1 - base)];
  const center: Vec3 = [box.center[0] + cu * c - cv * s, box.center[1] + cu * s + cv * c, base + dims[2] / 2];
  return { center, dims, pointCount: us.length };
}

/**
 * Fit for a freshly drawn footprint: estimates the heading by minimum-area rotation of the object
 * points (length = longer side), then refines with fitCuboidToPoints. Falls back to null when there
 * are too few points.
 */
export function fitCuboidWithYaw(positions: Float32Array, box: FitInput, opts: FitOptions): (FitResult & { yaw: number }) | null {
  const first = fitCuboidToPoints(positions, box, opts);
  if (!first) return null;
  const c = Math.cos(box.yaw), s = Math.sin(box.yaw);
  const margin = opts.margin ?? 0.3, band = opts.groundBand ?? 0.15;
  const hl = box.dims[0] / 2 + margin, hw = box.dims[1] / 2 + margin;
  const zTop = box.center[2] + box.dims[2] / 2 + (opts.headroom ?? 0.5);
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - box.center[0], dy = positions[i + 1] - box.center[1], z = positions[i + 2];
    if (z < opts.groundZ + band || z > zTop) continue;
    if (Math.abs(dx * c + dy * s) > hl || Math.abs(-dx * s + dy * c) > hw) continue;
    xs.push(positions[i]); ys.push(positions[i + 1]);
  }
  let best = { area: Infinity, theta: box.yaw };
  for (let deg = 0; deg < 90; deg += 3) {
    const th = (deg * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < xs.length; i++) {
      const u = xs[i] * ct + ys[i] * st, v = -xs[i] * st + ys[i] * ct;
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < best.area - 1e-9) best = { area, theta: th };
  }
  // length along the longer extent
  const ct = Math.cos(best.theta), st = Math.sin(best.theta);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const u = xs[i] * ct + ys[i] * st, v = -xs[i] * st + ys[i] * ct;
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  let yaw = best.theta;
  if (v1 - v0 > u1 - u0) yaw += Math.PI / 2;
  if (yaw > Math.PI) yaw -= 2 * Math.PI;
  const refined = fitCuboidToPoints(positions, { center: first.center, dims: [first.dims[0] + 0.2, first.dims[1] + 0.2, first.dims[2]], yaw }, { ...opts, margin: 0.1 });
  if (!refined) return { ...first, yaw: box.yaw };
  return { ...refined, yaw };
}
