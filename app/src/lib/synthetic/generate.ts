import { computeBounds } from "../pointcloud/parsers/common";
import type { NormalizedCloud } from "../pointcloud/types";
import { gaussian, mulberry32 } from "./prng";
import { CLASS_IDS, CLASS_MAP, type GeneratedScene, type ObjectSpec, type ReferenceCuboid, type SceneSpec } from "./types";

type Rng = () => number;
type V3 = [number, number, number];

interface Chunk { pos: number[]; inten: number[]; sem: number[]; inst: number[] }
const newChunk = (): Chunk => ({ pos: [], inten: [], sem: [], inst: [] });

const OBJ_DENSITY = 150; // points per m^2 at density=1 near the sensor
const fall = (r: number) => Math.max(0.15, 1 / (1 + (r / 20) ** 2));

const BASE_INTENSITY: Record<string, number> = {
  Ground: 0.25, Vehicle: 0.8, Pedestrian: 0.5, Cyclist: 0.55, Pole: 0.7, Building: 0.4, Vegetation: 0.3, Unknown: 0.5, Unlabeled: 0.3,
};

// ---- surface sampling in object-local frame (x forward, y left, z up, base at z=0) ----

interface Sampler { area: number; sample: (rng: Rng) => V3 }

function weighted(parts: Sampler[]): Sampler {
  const area = parts.reduce((s, p) => s + p.area, 0);
  return {
    area,
    sample: (rng) => {
      let t = rng() * area;
      for (const p of parts) { if (t < p.area) return p.sample(rng); t -= p.area; }
      return parts[parts.length - 1].sample(rng);
    },
  };
}

/** Prism from a 2D polygon, side faces for every edge not in `skip`, plus triangle caps. */
function prism(
  poly: [number, number][], tris: [number, number][][], ext: [number, number],
  map: (u: number, v: number, t: number) => V3, skip: number[], caps: number[],
): Sampler {
  const parts: Sampler[] = [];
  const len = ext[1] - ext[0];
  poly.forEach((a, i) => {
    if (skip.includes(i)) return;
    const b = poly[(i + 1) % poly.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    parts.push({ area: l * len, sample: (rng) => { const s = rng(); return map(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, ext[0] + rng() * len); } });
  });
  for (const t of caps) {
    for (const tri of tris) {
      const area = Math.abs((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])) / 2;
      parts.push({
        area,
        sample: (rng) => {
          let a = rng(), b = rng();
          if (a + b > 1) { a = 1 - a; b = 1 - b; }
          return map(tri[0][0] + a * (tri[1][0] - tri[0][0]) + b * (tri[2][0] - tri[0][0]), tri[0][1] + a * (tri[1][1] - tri[0][1]) + b * (tri[2][1] - tri[0][1]), t);
        },
      });
    }
  }
  return weighted(parts);
}

function makeSampler(o: ObjectSpec): Sampler {
  const [l, w, h] = o.dims;
  switch (o.kind) {
    case "box": {
      const p: [number, number][] = [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]];
      return prism(p, [[p[0], p[1], p[2]], [p[0], p[2], p[3]]], [0, h], (u, v, t) => [u, v, t], [], [h]);
    }
    case "lshape": {
      const t = 0.4 * Math.min(l, w);
      const p: [number, number][] = [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, -w / 2 + t], [-l / 2 + t, -w / 2 + t], [-l / 2 + t, w / 2], [-l / 2, w / 2]];
      const tris: [number, number][][] = [[p[0], p[1], p[2]], [p[0], p[2], p[3]], [p[0], p[3], p[4]], [p[0], p[4], p[5]]];
      return prism(p, tris, [0, h], (u, v, tt) => [u, v, tt], [], [h]);
    }
    case "wedge": {
      // x-z profile: tall cabin at the back, hood sloping down at the front (+x)
      const x1 = l * 0.1;
      const p: [number, number][] = [[-l / 2, 0], [l / 2, 0], [l / 2, h * 0.4], [x1, h], [-l / 2, h]];
      const tris: [number, number][][] = [[p[0], p[1], p[2]], [p[0], p[2], p[3]], [p[0], p[3], p[4]]];
      return prism(p, tris, [-w / 2, w / 2], (u, v, t) => [u, t, v], [0], [-w / 2, w / 2]);
    }
    case "cylinder": {
      const r = Math.min(l, w) / 2;
      return weighted([
        { area: 2 * Math.PI * r * h, sample: (rng) => { const a = rng() * 2 * Math.PI; return [r * Math.cos(a), r * Math.sin(a), rng() * h]; } },
        { area: Math.PI * r * r, sample: (rng) => { const a = rng() * 2 * Math.PI, d = r * Math.sqrt(rng()); return [d * Math.cos(a), d * Math.sin(a), h]; } },
      ]);
    }
    case "capsule": {
      const r = Math.min(l, w) / 2;
      const cyl = Math.max(0, h - 2 * r);
      const sphere = (zc: number, up: boolean) => (rng: Rng): V3 => {
        const a = rng() * 2 * Math.PI, c = rng(); // c = cos(polar) in [0,1]
        const s = Math.sqrt(1 - c * c);
        return [r * s * Math.cos(a), r * s * Math.sin(a), zc + (up ? 1 : -1) * r * c];
      };
      return weighted([
        { area: 2 * Math.PI * r * cyl, sample: (rng) => { const a = rng() * 2 * Math.PI; return [r * Math.cos(a), r * Math.sin(a), r + rng() * cyl]; } },
        { area: 2 * Math.PI * r * r, sample: sphere(h - r, true) },
        { area: 2 * Math.PI * r * r, sample: sphere(r, false) },
      ]);
    }
  }
}

function addObject(chunk: Chunk, o: ObjectSpec, pos: [number, number], rng: Rng, noise = 0.012) {
  const sampler = makeSampler(o);
  const r = Math.hypot(pos[0], pos[1]);
  const n = Math.max(30, Math.round(sampler.area * OBJ_DENSITY * fall(r) * (o.sparsity ?? 1) * densityScale.current));
  const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
  const sem = CLASS_IDS[o.label];
  const base = BASE_INTENSITY[o.label] ?? 0.5;
  // Occlusion: drop points on the side facing away from the sensor.
  const toSensor: [number, number] = r > 1e-6 ? [-pos[0] / r, -pos[1] / r] : [1, 0];
  const half = Math.max(o.dims[0], o.dims[1]) / 2;
  const occ = o.occlusionFraction ?? 0;
  for (let i = 0; i < n; i++) {
    const p = sampler.sample(rng);
    const wx = pos[0] + p[0] * cy - p[1] * sy, wy = pos[1] + p[0] * sy + p[1] * cy;
    if (occ > 0) {
      const u = ((wx - pos[0]) * toSensor[0] + (wy - pos[1]) * toSensor[1]) / half;
      if (u < -1 + 2 * occ) continue;
    }
    chunk.pos.push(wx + gaussian(rng) * noise, wy + gaussian(rng) * noise, p[2] + gaussian(rng) * noise);
    chunk.inten.push(clamp01(base + gaussian(rng) * 0.06));
    chunk.sem.push(sem);
    chunk.inst.push(o.instanceId);
  }
}

// Density multiplier is scene-wide; module-level holder avoids threading it through every call.
const densityScale = { current: 1 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function groundHeight(x: number, y: number): number {
  return 0.04 * Math.sin(x * 0.21 + 1.3) * Math.cos(y * 0.17) + 0.02 * Math.sin((x + y) * 0.43);
}

function buildStatic(spec: SceneSpec, rng: Rng): Chunk {
  const c = newChunk();
  const [w, d] = spec.extent;
  const nGround = Math.round(w * d * 8 * spec.density);
  const sensorH = 1.8;
  // ring radii: sensor at height sensorH, beam elevation steps of 0.35deg
  const rings: number[] = [];
  for (let k = 1; k < 300; k++) {
    const r = sensorH / Math.tan((k * 0.35 * Math.PI) / 180);
    if (r < 3) break;
    if (r < Math.hypot(w, d) / 2) rings.push(r);
  }
  rings.reverse();
  let made = 0, guard = 0;
  while (made < nGround && guard++ < nGround * 40) {
    let x = (rng() - 0.5) * w, y = (rng() - 0.5) * d;
    const r = Math.hypot(x, y);
    if (r < 3 || rng() > fall(r) * 1.4) continue;
    if (rng() < 0.85 && rings.length) {
      let best = rings[0];
      for (const rr of rings) if (Math.abs(rr - r) < Math.abs(best - r)) best = rr;
      x *= best / r; y *= best / r;
      x += gaussian(rng) * 0.02; y += gaussian(rng) * 0.02;
    }
    if (Math.abs(x) > w / 2 || Math.abs(y) > d / 2) continue;
    c.pos.push(x, y, groundHeight(x, y) + gaussian(rng) * spec.groundNoise);
    c.inten.push(clamp01(0.25 + gaussian(rng) * 0.05));
    c.sem.push(CLASS_IDS.Ground);
    c.inst.push(0);
    made++;
  }
  if (spec.walls) {
    const H = 6;
    const sides: { axis: 0 | 1; off: number; len: number }[] = [
      { axis: 0, off: d / 2, len: w }, { axis: 0, off: -d / 2, len: w }, { axis: 1, off: w / 2, len: d }, { axis: 1, off: -w / 2, len: d },
    ];
    for (const s of sides) {
      const n = Math.round(s.len * H * 3 * spec.density);
      for (let i = 0; i < n; i++) {
        const t = (rng() - 0.5) * s.len, z = rng() * H;
        const x = s.axis === 0 ? t : s.off, y = s.axis === 0 ? s.off : t;
        if (rng() > fall(Math.hypot(x, y)) * 2.2) continue;
        c.pos.push(x + gaussian(rng) * 0.02, y + gaussian(rng) * 0.02, z + gaussian(rng) * 0.02);
        c.inten.push(clamp01(0.4 + gaussian(rng) * 0.05));
        c.sem.push(CLASS_IDS.Building);
        c.inst.push(0);
      }
    }
  }
  return c;
}

function occlusionAttr(f: number | undefined): ReferenceCuboid["attributes"] {
  const v = f ?? 0;
  return { occlusion: v < 0.05 ? "none" : v < 0.4 ? "partial" : "heavy" };
}

function cuboidFor(o: ObjectSpec, pos: [number, number]): ReferenceCuboid {
  return {
    id: `cub-${o.instanceId}`,
    trackId: o.trackId,
    label: o.label,
    center: [pos[0], pos[1], o.dims[2] / 2],
    dims: [...o.dims],
    yaw: o.yaw,
    attributes: occlusionAttr(o.occlusionFraction),
  };
}

export function generateScene(spec: SceneSpec): GeneratedScene {
  densityScale.current = spec.density;
  const nFrames = Math.max(1, spec.frames ?? 1);
  const statics = buildStatic(spec, mulberry32(spec.seed));
  const frames: NormalizedCloud[] = [];
  const frameCuboids: { index: number; cuboids: ReferenceCuboid[] }[] = [];

  for (let f = 0; f < nFrames; f++) {
    const chunk: Chunk = { pos: statics.pos.slice(), inten: statics.inten.slice(), sem: statics.sem.slice(), inst: statics.inst.slice() };
    const cuboids: ReferenceCuboid[] = [];
    spec.objects.forEach((o, idx) => {
      if (o.hiddenFrames?.includes(f)) return;
      const pos: [number, number] = [o.center[0] + (o.velocity?.[0] ?? 0) * f, o.center[1] + (o.velocity?.[1] ?? 0) * f];
      addObject(chunk, o, pos, mulberry32(spec.seed * 7919 + f * 104729 + idx * 31 + 17));
      cuboids.push(cuboidFor(o, pos));
    });
    const n = chunk.sem.length;
    const positions = Float32Array.from(chunk.pos);
    frames.push({
      pointCount: n,
      positions,
      intensity: Float32Array.from(chunk.inten),
      labels: { semantic: Uint16Array.from(chunk.sem), instance: Uint16Array.from(chunk.inst) },
      upAxis: "Z",
      bounds: computeBounds(positions, n),
      frameIndex: f,
      metadata: { synthetic: true, seed: spec.seed, classMap: CLASS_MAP, extent: spec.extent },
    });
    frameCuboids.push({ index: f, cuboids });
  }
  const cloud = frames[0];
  const reference = {
    cuboids: frameCuboids[0].cuboids,
    pointLabels: { semantic: cloud.labels!.semantic, instance: cloud.labels!.instance, classMap: CLASS_MAP },
    frames: nFrames > 1 ? frameCuboids : undefined,
  };
  return { cloud, frames, reference };
}
