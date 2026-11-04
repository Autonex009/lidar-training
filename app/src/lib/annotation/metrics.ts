import { iou3d } from "@/lib/geometry/cuboid";
import { b64ToU16, type AnnotationDocument, type Cuboid, type Vec3 } from "./types";
import { PLANTED_TO_TAG } from "./task-config";

export interface RefCuboid { id: string; trackId?: number; label: string; center: Vec3; dims: Vec3; yaw: number; attributes?: Record<string, unknown> }
export interface ReferenceData {
  cuboids: RefCuboid[];
  frames?: { index: number; cuboids: RefCuboid[] }[];
  pointLabels?: { semanticB64?: string; instanceB64?: string; classMap?: Record<string, string> };
}
export interface PlantedErrorRef { type: string; cuboidId: string; description?: string }
export interface MetricsContext {
  plantedErrors?: PlantedErrorRef[];
  initialCuboids?: RefCuboid[];
  /** Class name -> semantic label id used for segmentation. */
  classIds?: Record<string, number>;
  checkpointKeys?: string[];
  questionKeys?: string[];
  requiredAttributes?: string[];
}

export interface MatchResult {
  pairs: { ref: number; cand: number; iou: number }[];
  refCount: number;
  candCount: number;
}

/** Greedy matching by descending IoU (each box used once). */
export function matchBoxes(refs: { center: Vec3; dims: Vec3; yaw: number }[], cands: { center: Vec3; dims: Vec3; yaw: number }[], minIou = 1e-6): MatchResult {
  const all: { ref: number; cand: number; iou: number }[] = [];
  refs.forEach((r, i) => cands.forEach((c, j) => { const v = iou3d(r, c); if (v > minIou) all.push({ ref: i, cand: j, iou: v }); }));
  all.sort((a, b) => b.iou - a.iou);
  const ur = new Set<number>(), uc = new Set<number>(), pairs: MatchResult["pairs"] = [];
  for (const p of all) {
    if (ur.has(p.ref) || uc.has(p.cand)) continue;
    ur.add(p.ref); uc.add(p.cand); pairs.push(p);
  }
  return { pairs, refCount: refs.length, candCount: cands.length };
}

/** Smallest absolute angle between a and b, modulo 2*pi (0..pi). */
export function yawErr2pi(a: number, b: number): number {
  const d = Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  return d;
}
/** Same, treating a box as symmetric under a 180 degree turn (0..pi/2). */
export function yawErrPi(a: number, b: number): number {
  const d = yawErr2pi(a, b);
  return Math.min(d, Math.PI - d);
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const round = (v: number | null, n = 4) => (v === null ? null : Math.round(v * 10 ** n) / 10 ** n);

export interface BoxMetrics {
  refCount: number; candCount: number;
  matched: number;
  meanIou: number | null;
  classMatch: number | null;
  meanCenterError: number | null;
  meanYawErrorDeg: number | null;
  meanYawErrorSymmetricDeg: number | null;
  precision: number | null; recall: number | null; tpAt50: number;
}

export function boxMetrics(refs: RefCuboid[], cands: Cuboid[]): BoxMetrics {
  const m = matchBoxes(refs, cands);
  const ious = refs.map((_, i) => m.pairs.find((p) => p.ref === i)?.iou ?? 0);
  const cls = m.pairs.map((p) => (refs[p.ref].label === cands[p.cand].label ? 1 : 0) as number);
  const ce = m.pairs.map((p) => Math.hypot(...([0, 1, 2] as const).map((k) => refs[p.ref].center[k] - cands[p.cand].center[k]) as [number, number, number]));
  const deg = 180 / Math.PI;
  const tp = m.pairs.filter((p) => p.iou >= 0.5).length;
  return {
    refCount: refs.length, candCount: cands.length, matched: m.pairs.length,
    meanIou: round(refs.length ? ious.reduce((a, b) => a + b, 0) / refs.length : null),
    classMatch: round(refs.length ? cls.reduce((a, b) => a + b, 0) / refs.length : null),
    meanCenterError: round(mean(ce)),
    meanYawErrorDeg: round(mean(m.pairs.map((p) => yawErr2pi(refs[p.ref].yaw, cands[p.cand].yaw) * deg)), 2),
    meanYawErrorSymmetricDeg: round(mean(m.pairs.map((p) => yawErrPi(refs[p.ref].yaw, cands[p.cand].yaw) * deg)), 2),
    precision: round(cands.length ? tp / cands.length : refs.length ? 0 : null),
    recall: round(refs.length ? tp / refs.length : null),
    tpAt50: tp,
  };
}

export interface TrackMetrics { idSwitches: number; transitions: number; continuity: number | null; refTracks: number; fragmented: number }

/** Track continuity: for every reference track, follow the candidate track id matched in each frame (IoU >= 0.3) and count changes. */
export function trackMetrics(refFrames: { index: number; cuboids: RefCuboid[] }[], doc: AnnotationDocument): TrackMetrics {
  const seq = new Map<number, (number | null)[]>();
  const sorted = [...refFrames].sort((a, b) => a.index - b.index);
  for (const rf of sorted) {
    const cands = doc.frames[rf.index]?.cuboids ?? [];
    const m = matchBoxes(rf.cuboids, cands, 0.3 - 1e-9);
    rf.cuboids.forEach((r, i) => {
      if (r.trackId === undefined) return;
      const p = m.pairs.find((x) => x.ref === i && x.iou >= 0.3);
      const arr = seq.get(r.trackId) ?? [];
      arr.push(p ? cands[p.cand].trackId ?? null : null);
      seq.set(r.trackId, arr);
    });
  }
  let switches = 0, transitions = 0, fragmented = 0;
  for (const arr of seq.values()) {
    const ids = arr.filter((x): x is number => x !== null);
    for (let i = 1; i < ids.length; i++) { transitions++; if (ids[i] !== ids[i - 1]) switches++; }
    if (new Set(ids).size > 1) fragmented++;
  }
  return { idSwitches: switches, transitions, continuity: round(transitions ? 1 - switches / transitions : seq.size ? 1 : null), refTracks: seq.size, fragmented };
}

export interface PointMetrics { frames: number; labeledFraction: number | null; accuracy: number | null; instanceMatchRate: number | null; instanceMeanIou: number | null }

export function pointMetrics(doc: AnnotationDocument, ref: ReferenceData, ctx: MetricsContext): PointMetrics | null {
  if (!doc.pointLabels?.length || !ref.pointLabels?.semanticB64) return null;
  const refSem = b64ToU16(ref.pointLabels.semanticB64);
  const refInst = ref.pointLabels.instanceB64 ? b64ToU16(ref.pointLabels.instanceB64) : null;
  const allowed = ctx.classIds ? new Set(Object.values(ctx.classIds)) : null;
  let total = 0, correct = 0, labeled = 0, frames = 0;
  const overlap = new Map<string, number>(), refSize = new Map<number, number>(), candSize = new Map<number, number>();
  for (const pl of doc.pointLabels) {
    if (pl.frame !== 0) continue; // reference labels exist for the first frame only
    frames++;
    const sem = pl.semantic ? b64ToU16(pl.semantic) : null;
    const inst = pl.instance ? b64ToU16(pl.instance) : null;
    const n = refSem.length;
    for (let i = 0; i < n; i++) {
      if (allowed && !allowed.has(refSem[i])) continue;
      total++;
      if (sem) { if (sem[i] !== 0) labeled++; if (sem[i] === refSem[i]) correct++; }
      else if (inst && inst[i] !== 0) labeled++;
      if (refInst && inst && refSem[i] !== 1 && refSem[i] !== 0 && refInst[i] !== 0) {
        const r = refInst[i], c = inst[i];
        refSize.set(r, (refSize.get(r) ?? 0) + 1);
        if (c !== 0) { overlap.set(`${r}:${c}`, (overlap.get(`${r}:${c}`) ?? 0) + 1); }
      }
      if (inst && inst[i] !== 0) candSize.set(inst[i], (candSize.get(inst[i]) ?? 0) + 1);
    }
  }
  let instMatch: number | null = null, instIou: number | null = null;
  if (refInst && refSize.size && doc.pointLabels.some((p) => p.instance)) {
    let hits = 0, sumIou = 0;
    for (const [r, rs] of refSize) {
      let best = 0;
      for (const [key, ov] of overlap) {
        const [rr, cc] = key.split(":").map(Number);
        if (rr !== r) continue;
        best = Math.max(best, ov / (rs + (candSize.get(cc) ?? 0) - ov));
      }
      sumIou += best;
      if (best >= 0.5) hits++;
    }
    instMatch = round(hits / refSize.size);
    instIou = round(sumIou / refSize.size);
  }
  return {
    frames, labeledFraction: round(total ? labeled / total : null),
    accuracy: round(total && doc.pointLabels.some((p) => p.semantic) ? correct / total : null),
    instanceMatchRate: instMatch, instanceMeanIou: instIou,
  };
}

export interface ErrorMetrics { planted: number; found: number; foundWithTag: number; falsePositives: number; reported: number }

export function errorMetrics(doc: AnnotationDocument, planted: PlantedErrorRef[], ref: ReferenceData, initial: RefCuboid[]): ErrorMetrics {
  const reports = doc.errorsFound ?? [];
  const geom = (id?: string) => (id ? initial.find((c) => c.id === id) ?? ref.cuboids.find((c) => c.id === id) : undefined);
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const used = new Set<string>();
  let found = 0, foundTag = 0;
  for (const p of planted) {
    const pg = geom(p.cuboidId);
    const hit = reports.find((r) => {
      if (used.has(r.id)) return false;
      if (r.targetAnnotationId === p.cuboidId) return true;
      const tg = geom(r.targetAnnotationId);
      if (tg && pg && dist(tg.center, pg.center) < 0.6) return true;
      if (r.position && pg && p.type === "missing_object" && dist(r.position, pg.center) < 2.5) return true;
      return false;
    });
    if (hit) { used.add(hit.id); found++; if (hit.tag === PLANTED_TO_TAG[p.type]) foundTag++; }
  }
  return { planted: planted.length, found, foundWithTag: foundTag, falsePositives: reports.length - used.size, reported: reports.length };
}

export interface SubmissionMetrics {
  computedAt: string;
  boxes?: BoxMetrics;
  perFrame?: { frame: number; metrics: BoxMetrics }[];
  tracks?: TrackMetrics;
  points?: PointMetrics;
  errors?: ErrorMetrics;
  checkpoints?: { done: number; total: number };
  answers?: { provided: number; total: number };
  attributes?: { setRate: number | null; matchRate: number | null };
  flags: number;
}

/** Advisory metrics for a candidate document against the hidden reference. Never auto-scores. */
export function computeMetrics(doc: AnnotationDocument, ref: ReferenceData | null, ctx: MetricsContext = {}, now = new Date()): SubmissionMetrics {
  const out: SubmissionMetrics = { computedAt: now.toISOString(), flags: doc.flags.length };
  if (ctx.checkpointKeys?.length) out.checkpoints = { done: ctx.checkpointKeys.filter((k) => doc.checkpoints[k]).length, total: ctx.checkpointKeys.length };
  if (ctx.questionKeys?.length) out.answers = { provided: ctx.questionKeys.filter((k) => String(doc.answers[k] ?? "").trim() !== "").length, total: ctx.questionKeys.length };
  if (!ref) return out;
  const multi = ref.frames && ref.frames.length > 1;
  if (multi) {
    out.perFrame = ref.frames!.map((f) => ({ frame: f.index, metrics: boxMetrics(f.cuboids, doc.frames[f.index]?.cuboids ?? []) }));
    const all = ref.frames!.flatMap((f) => f.cuboids.map((c) => ({ f: f.index, c })));
    const cands = ref.frames!.flatMap((f) => doc.frames[f.index]?.cuboids ?? []);
    // aggregate: pooled counts across frames
    let tp = 0, mat = 0, cm = 0; const ious: number[] = []; const ces: number[] = [];
    for (const pf of out.perFrame) {
      const b = pf.metrics;
      tp += b.tpAt50; mat += b.matched;
      if (b.classMatch !== null) cm += b.classMatch * b.refCount;
      if (b.meanIou !== null) ious.push(b.meanIou * b.refCount);
      if (b.meanCenterError !== null) ces.push(b.meanCenterError);
    }
    out.boxes = {
      refCount: all.length, candCount: cands.length, matched: mat,
      meanIou: round(all.length ? ious.reduce((a, b) => a + b, 0) / all.length : null),
      classMatch: round(all.length ? cm / all.length : null),
      meanCenterError: round(mean(ces)),
      meanYawErrorDeg: round(mean(out.perFrame.map((p) => p.metrics.meanYawErrorDeg).filter((x): x is number => x !== null)), 2),
      meanYawErrorSymmetricDeg: round(mean(out.perFrame.map((p) => p.metrics.meanYawErrorSymmetricDeg).filter((x): x is number => x !== null)), 2),
      precision: round(cands.length ? tp / cands.length : null), recall: round(all.length ? tp / all.length : null), tpAt50: tp,
    };
    out.tracks = trackMetrics(ref.frames!, doc);
  } else if (ref.cuboids.length) {
    out.boxes = boxMetrics(ref.cuboids, doc.frames[0]?.cuboids ?? []);
    // attributes on matched pairs
    const cands = doc.frames[0]?.cuboids ?? [];
    const m = matchBoxes(ref.cuboids, cands);
    const keys = ctx.requiredAttributes ?? [];
    if (keys.length && m.pairs.length) {
      let set = 0, match = 0, total = 0;
      for (const p of m.pairs) for (const k of keys) {
        total++;
        const v = cands[p.cand].attributes[k]; const rv = ref.cuboids[p.ref].attributes?.[k];
        if (v) { set++; if (rv === undefined || rv === v) match++; }
      }
      out.attributes = { setRate: round(set / total), matchRate: round(match / total) };
    }
  }
  const pm = pointMetrics(doc, ref, ctx);
  if (pm) out.points = pm;
  if (ctx.plantedErrors?.length) out.errors = errorMetrics(doc, ctx.plantedErrors, ref, ctx.initialCuboids ?? []);
  return out;
}
