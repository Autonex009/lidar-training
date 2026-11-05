import type { DecisionCard, FindTarget } from "@/content";
import { iou3d, type Box } from "@/lib/geometry/cuboid";

/** Pure logic behind the interactive Learn widgets (kept free of React / three so it is unit-testable). */

export type Vec3 = [number, number, number];
export interface RefBox extends Box { label: string }

// ---------- seeded order ----------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle (returns a copy). */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- geometry ----------

/** Point in the box frame: (u along heading, v across, z up relative to the centre). */
export function toLocal(p: Vec3, b: Box): Vec3 {
  const dx = p[0] - b.center[0], dy = p[1] - b.center[1];
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return [dx * c + dy * s, -dx * s + dy * c, p[2] - b.center[2]];
}

/** Is `p` inside the (yawed) box, optionally grown by `margin` metres on every side? */
export function pointInCuboid(p: Vec3, b: Box, margin = 0): boolean {
  const [u, v, z] = toLocal(p, b);
  return Math.abs(u) <= b.dims[0] / 2 + margin && Math.abs(v) <= b.dims[1] / 2 + margin && Math.abs(z) <= b.dims[2] / 2 + margin;
}

/** Footprint-only version (ignores height). */
export function pointInFootprint(p: Vec3 | [number, number], b: Box, margin = 0): boolean {
  const [u, v] = toLocal([p[0], p[1], b.center[2]], b);
  return Math.abs(u) <= b.dims[0] / 2 + margin && Math.abs(v) <= b.dims[1] / 2 + margin;
}

/** Smallest difference between two headings, treating a box as symmetric under a half turn. */
export function yawErrorPi(a: number, b: number): number {
  const d = Math.abs((((a - b) % Math.PI) + Math.PI) % Math.PI);
  return Math.min(d, Math.PI - d);
}

export interface FitQuality { iou: number; centerErr: number; yawErrDeg: number }

export function fitQuality(box: Box, ref: Box): FitQuality {
  return {
    iou: iou3d(box, ref),
    centerErr: Math.hypot(box.center[0] - ref.center[0], box.center[1] - ref.center[1], box.center[2] - ref.center[2]),
    yawErrDeg: (yawErrorPi(box.yaw, ref.yaw) * 180) / Math.PI,
  };
}

export const FIT_PASS_IOU = 0.7;

// ---------- find-object ----------

export interface FindClick {
  /** Nearest rendered point under the cursor. */
  pick: Vec3 | null;
  /** Ground-plane hit under the cursor. */
  ground: Vec3 | null;
  groundZ: number;
}

export type ResolvedTarget =
  | { kind: "object"; boxes: RefBox[] }
  | { kind: "region"; center: [number, number]; radius: number }
  | { kind: "ground"; avoid: RefBox[] };

/** Resolve a content target against the scene's reference cuboids. `origin` is the sensor position (for "nearest"). */
export function resolveFindTarget(t: FindTarget, refs: readonly RefBox[], origin: [number, number] = [0, 0]): ResolvedTarget {
  if (t.kind === "region") return { kind: "region", center: t.center, radius: t.radius };
  if (t.kind === "ground") return { kind: "ground", avoid: [...refs] };
  const same = refs.filter((r) => r.label === t.label);
  if (t.nearest) {
    const d = (r: RefBox) => Math.hypot(r.center[0] - origin[0], r.center[1] - origin[1]);
    const best = [...same].sort((a, b) => d(a) - d(b))[0];
    return { kind: "object", boxes: best ? [best] : [] };
  }
  if (t.nth !== undefined) return { kind: "object", boxes: same[t.nth] ? [same[t.nth]] : [] };
  return { kind: "object", boxes: same };
}

const HIT_MARGIN = 0.4;

/** Did this click satisfy the target? */
export function findHit(t: ResolvedTarget, click: FindClick): boolean {
  const xy = click.pick ?? click.ground;
  if (t.kind === "region") return !!xy && Math.hypot(xy[0] - t.center[0], xy[1] - t.center[1]) <= t.radius;
  if (t.kind === "object") {
    if (click.pick && t.boxes.some((b) => pointInCuboid(click.pick as Vec3, b, HIT_MARGIN))) return true;
    // clicked a gap in a sparse object: the ground under it still counts
    return !click.pick && !!click.ground && t.boxes.some((b) => pointInFootprint(click.ground as Vec3, b, HIT_MARGIN));
  }
  // ground: empty ground that is not under any object. The ground-plane hit decides; a picked point only matters
  // when it lies on an object (picks are fuzzy when zoomed out and can catch walls or clutter near the ray).
  if (click.pick && t.avoid.some((b) => pointInCuboid(click.pick as Vec3, b, 0.5))) return false;
  if (click.ground) return !t.avoid.some((b) => pointInFootprint(click.ground as Vec3, b, 1));
  return !!click.pick && click.pick[2] <= click.groundZ + 0.2 && !t.avoid.some((b) => pointInFootprint(click.pick as Vec3, b, 0.5));
}

// ---------- decision cards ----------

export interface CardScore {
  total: number;
  answered: number;
  correctCount: number;
  pct: number;
  passed: boolean;
  allAnswered: boolean;
  wrongIds: string[];
}

/** `answers` maps card id -> chosen choice index. Unanswered cards count as wrong. */
export function scoreDecisionCards(cards: readonly DecisionCard[], answers: Readonly<Record<string, number | undefined>>, passPct = 80): CardScore {
  const total = cards.length;
  const answered = cards.filter((c) => answers[c.id] !== undefined).length;
  const wrongIds = cards.filter((c) => answers[c.id] !== undefined && answers[c.id] !== c.correct).map((c) => c.id);
  const correctCount = cards.filter((c) => answers[c.id] === c.correct).length;
  const pct = total ? Math.round((correctCount / total) * 100) : 0;
  return { total, answered, correctCount, pct, passed: answered === total && pct >= passPct, allAnswered: answered === total, wrongIds };
}

// ---------- views drill ----------

export function gradeCount(answer: number, truth: number, tolerance = 0): boolean {
  return Number.isFinite(answer) && Math.abs(answer - truth) <= tolerance;
}

/** The class (among `options`) with the greatest reference height. */
export function tallestClass(refs: readonly RefBox[], options: readonly string[]): string | null {
  let best: { label: string; h: number } | null = null;
  for (const r of refs) if (options.includes(r.label) && (!best || r.dims[2] > best.h)) best = { label: r.label, h: r.dims[2] };
  return best?.label ?? null;
}

export function gradeTallest(choice: string, refs: readonly RefBox[], options: readonly string[]): boolean {
  return tallestClass(refs, options) === choice;
}

export const countLabel = (refs: readonly RefBox[], label: string) => refs.filter((r) => r.label === label).length;

// ---------- cuboid edits ----------

export interface PatchKinds { moved: boolean; resized: boolean; rotated: boolean; relabelled: boolean }

/** What a patch really changed (a drag gesture sends center+dims+yaw even when only one differs). */
export function classifyPatch(prev: Box & { label?: string }, patch: Partial<Box & { label: string }>): PatchKinds {
  const moved = !!patch.center && Math.hypot(patch.center[0] - prev.center[0], patch.center[1] - prev.center[1]) > 0.02;
  const resized = !!patch.dims && patch.dims.some((d, i) => Math.abs(d - prev.dims[i]) > 0.02);
  const rotated = patch.yaw !== undefined && yawDiff(patch.yaw, prev.yaw) > 0.005;
  const relabelled = patch.label !== undefined && patch.label !== prev.label;
  return { moved, resized, rotated, relabelled };
}

function yawDiff(a: number, b: number) {
  const d = Math.abs((a - b) % (2 * Math.PI));
  return Math.min(d, 2 * Math.PI - d);
}

// ---------- mistake overlay ----------

export type FaceKey = "l+" | "l-" | "w+" | "w-" | "h+" | "h-";
export type FaceStatus = "ok" | "cut" | "margin";
export const FACE_KEYS: FaceKey[] = ["l+", "l-", "w+", "w-", "h+", "h-"];

export interface MistakeOptions {
  groundZ: number;
  /** Ignore points this close to the ground. */
  groundBand?: number;
  /** A face "cuts" the object when at least this many points sit just outside it. */
  cutPoints?: number;
  /** Depth of the shell outside a face that is searched for cut points. */
  shell?: number;
  /** Points closer than this to a face are surface noise, not a cut. */
  slack?: number;
  /** Empty gap at a face, as a fraction of the object's size along that axis, above which the face is "margin". */
  marginFrac?: number;
}

/**
 * Per-face verdict for a box over a cloud: "cut" when object points poke through the face, "margin" when the
 * gap between the face and the nearest object point inside exceeds 20% of the object's size on that axis, else "ok".
 * Cut wins over margin. A box with no object points inside is "margin" on every face.
 */
export function classifyMistakes(positions: ArrayLike<number>, box: Box, o: MistakeOptions): Record<FaceKey, FaceStatus> {
  const band = o.groundBand ?? 0.3, cutPts = o.cutPoints ?? 3, shell = o.shell ?? 0.3, slack = o.slack ?? 0.1, frac = o.marginFrac ?? 0.2;
  const hl = box.dims[0] / 2, hw = box.dims[1] / 2, hh = box.dims[2] / 2;
  const reach = shell + 0.5;
  const c = Math.cos(box.yaw), s = Math.sin(box.yaw);
  const out: Record<FaceKey, FaceStatus> = { "l+": "ok", "l-": "ok", "w+": "ok", "w-": "ok", "h+": "ok", "h-": "ok" };
  const cut: Record<FaceKey, number> = { "l+": 0, "l-": 0, "w+": 0, "w-": 0, "h+": 0, "h-": 0 };
  let n = 0, uMax = -Infinity, uMin = Infinity, vMax = -Infinity, vMin = Infinity, zMax = -Infinity, zMin = Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const z = positions[i + 2] - box.center[2];
    if (positions[i + 2] < o.groundZ + band || Math.abs(z) > hh + reach) continue;
    const dx = positions[i] - box.center[0], dy = positions[i + 1] - box.center[1];
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (Math.abs(u) > hl + reach || Math.abs(v) > hw + reach) continue;
    const inU = Math.abs(u) <= hl, inV = Math.abs(v) <= hw, inZ = Math.abs(z) <= hh;
    if (inU && inV && inZ) {
      n++;
      uMax = Math.max(uMax, u); uMin = Math.min(uMin, u); vMax = Math.max(vMax, v); vMin = Math.min(vMin, v); zMax = Math.max(zMax, z); zMin = Math.min(zMin, z);
      continue;
    }
    // just outside exactly one face and within the other two extents
    if (inV && inZ) { if (u > hl + slack && u <= hl + shell) cut["l+"]++; else if (u < -hl - slack && u >= -hl - shell) cut["l-"]++; }
    else if (inU && inZ) { if (v > hw + slack && v <= hw + shell) cut["w+"]++; else if (v < -hw - slack && v >= -hw - shell) cut["w-"]++; }
    else if (inU && inV) { if (z > hh + slack && z <= hh + shell) cut["h+"]++; else if (z < -hh - slack && z >= -hh - shell) cut["h-"]++; }
  }
  const empty = n < 3;
  const gaps: Record<FaceKey, number> = empty
    ? { "l+": Infinity, "l-": Infinity, "w+": Infinity, "w-": Infinity, "h+": Infinity, "h-": Infinity }
    : { "l+": hl - uMax, "l-": uMin + hl, "w+": hw - vMax, "w-": vMin + hw, "h+": hh - zMax, "h-": zMin + hh };
  // margin is judged against the size of the object (the extent of the points inside), not of the box
  const ext = empty ? [hl * 2, hw * 2, hh * 2] : [Math.max(0.1, uMax - uMin), Math.max(0.1, vMax - vMin), Math.max(0.1, zMax - zMin)];
  const size: Record<FaceKey, number> = { "l+": ext[0], "l-": ext[0], "w+": ext[1], "w-": ext[1], "h+": ext[2], "h-": ext[2] };
  for (const k of FACE_KEYS) {
    if (cut[k] >= cutPts) out[k] = "cut";
    else if (gaps[k] > frac * size[k]) out[k] = "margin";
  }
  return out;
}

export function mistakeSummary(m: Record<FaceKey, FaceStatus>): { cuts: number; margins: number } {
  const v = Object.values(m);
  return { cuts: v.filter((x) => x === "cut").length, margins: v.filter((x) => x === "margin").length };
}
