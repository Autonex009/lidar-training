import type { SubmissionMetrics } from "@/lib/annotation/metrics";

/** Subset of ScoringCriteria used here (kept structural so this file stays client-safe). */
export interface ScoringCriteriaLike {
  autoMetrics?: string[];
  thresholds?: Record<string, number>;
  reviewerWeight?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const higher = (v: number | null | undefined, thr: number) => (v === null || v === undefined ? null : clamp01(v / thr));
const lower = (v: number | null | undefined, thr: number) => (v === null || v === undefined ? null : v <= thr ? 1 : clamp01(thr / v));

/** Per-metric 0..1 component for the metrics named in the task's `autoMetrics`. Missing data yields null. */
export function metricComponents(m: SubmissionMetrics | null, c: ScoringCriteriaLike): { key: string; value: number | null }[] {
  const th = c.thresholds ?? {};
  return (c.autoMetrics ?? []).map((key) => {
    let value: number | null = null;
    if (m) {
      switch (key) {
        case "classMatch": value = higher(m.boxes?.classMatch, 1); break;
        case "centerError": value = lower(m.boxes?.meanCenterError, th.centerErrorM ?? 0.3); break;
        case "iou3d": value = higher(m.boxes?.meanIou, th.iou3d ?? 0.5); break;
        case "yawError": value = lower(m.boxes?.meanYawErrorSymmetricDeg, th.yawErrorDeg ?? 10); break;
        case "pointLabelAccuracy": value = higher(m.points?.accuracy, th.pointLabelAccuracy ?? 0.9); break;
        case "instanceSeparation": value = higher(m.points?.instanceMeanIou, th.instanceSeparation ?? 0.8); break;
        case "trackContinuity": value = higher(m.tracks?.continuity, th.trackContinuity ?? 0.9); break;
        case "errorsFound":
          if (m.errors && m.errors.planted > 0) value = clamp01((m.errors.found - 0.5 * m.errors.falsePositives) / m.errors.planted);
          break;
        case "checkpointsDone": value = m.checkpoints && m.checkpoints.total ? m.checkpoints.done / m.checkpoints.total : null; break;
        case "answersProvided": value = m.answers && m.answers.total ? m.answers.provided / m.answers.total : null; break;
      }
    }
    return { key, value };
  });
}

/** Mean of the available metric components, 0..100 (null when no metric is available). */
export function autoScore(m: SubmissionMetrics | null, c: ScoringCriteriaLike): number | null {
  const vals = metricComponents(m, c).map((x) => x.value).filter((x): x is number => x !== null);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length) * 100;
}

/**
 * Suggested final score (integer 0..100): blend of the advisory metric score and the reviewer's own judgement.
 *   suggested = (1 - w) * auto + w * judgement,  w = scoringCriteria.reviewerWeight
 * `judgement` is the weighted mean of the per-criterion rubric scores the reviewer has entered so far; until any are
 * entered it defaults to the auto score, so the suggestion equals the metric score. With no metrics, the judgement
 * alone is used; with neither, there is no suggestion (null).
 */
export function suggestedScore(m: SubmissionMetrics | null, c: ScoringCriteriaLike, judgement?: number | null): number | null {
  const auto = autoScore(m, c);
  const w = clamp01(c.reviewerWeight ?? 0.5);
  if (auto === null && (judgement === null || judgement === undefined)) return null;
  if (auto === null) return Math.round(judgement as number);
  const j = judgement === null || judgement === undefined ? auto : judgement;
  return Math.round(clamp01(((1 - w) * auto + w * j) / 100) * 100);
}

/** Weighted mean (by criterion weight) of entered rubric scores; null when none entered. */
export function rubricJudgement(rubric: { key: string; weight: number }[], scores: Record<string, number>): number | null {
  let wsum = 0, acc = 0;
  for (const r of rubric) {
    const s = scores[r.key];
    if (typeof s !== "number") continue;
    wsum += r.weight;
    acc += r.weight * s;
  }
  return wsum > 0 ? acc / wsum : null;
}

export interface MetricNote { label: string; value: string; note: string }

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : `${Math.round(v * 100)}%`);

/** Plain-language rows for the reviewer's advisory metrics table. */
export function describeMetrics(m: SubmissionMetrics | null): MetricNote[] {
  if (!m) return [];
  const out: MetricNote[] = [];
  const b = m.boxes;
  if (b) {
    out.push({ label: "Objects matched", value: `${b.matched} / ${b.refCount}`, note: b.refCount - b.matched > 0 ? `${b.refCount - b.matched} of ${b.refCount} reference objects unmatched` : "Every reference object has an overlapping box" });
    if (b.candCount > b.matched) out.push({ label: "Extra boxes", value: String(b.candCount - b.matched), note: `${b.candCount - b.matched} trainee box(es) overlap no reference object` });
    out.push({ label: "Mean 3D IoU", value: b.meanIou === null ? "n/a" : b.meanIou.toFixed(2), note: b.meanIou !== null && b.meanIou < 0.5 ? "Boxes overlap the reference only loosely" : "Boxes overlap the reference well" });
    out.push({ label: "Class match", value: pct(b.classMatch), note: b.classMatch !== null && b.classMatch < 1 ? "Some matched boxes carry a different class than the reference" : "All matched boxes use the reference class" });
    if (b.meanCenterError !== null) out.push({ label: "Mean center error", value: `${b.meanCenterError.toFixed(2)} m`, note: b.meanCenterError > 0.3 ? "Box centers are noticeably offset" : "Centers are close to the reference" });
    if (b.meanYawErrorDeg !== null) out.push({ label: "Mean yaw error", value: `${b.meanYawErrorDeg.toFixed(0)}°`, note: `mean yaw error ${b.meanYawErrorDeg.toFixed(0)}° (${(b.meanYawErrorSymmetricDeg ?? 0).toFixed(0)}° if front/back is ignored)` });
    out.push({ label: "Precision / recall @ IoU 0.5", value: `${pct(b.precision)} / ${pct(b.recall)}`, note: `${b.tpAt50} box(es) reach IoU 0.5` });
  }
  if (m.tracks) out.push({ label: "Track continuity", value: pct(m.tracks.continuity), note: `${m.tracks.idSwitches} ID switch(es) over ${m.tracks.transitions} transitions; ${m.tracks.fragmented} fragmented track(s)` });
  if (m.points) {
    if (m.points.accuracy !== null) out.push({ label: "Point label accuracy", value: pct(m.points.accuracy), note: `${pct(m.points.labeledFraction)} of in-scope points labelled` });
    if (m.points.instanceMeanIou !== null) out.push({ label: "Instance mean IoU", value: m.points.instanceMeanIou.toFixed(2), note: `${pct(m.points.instanceMatchRate)} of reference instances matched at IoU 0.5` });
  }
  if (m.errors) out.push({ label: "Planted errors found", value: `${m.errors.found} / ${m.errors.planted}`, note: `${m.errors.foundWithTag} with the right tag; ${m.errors.falsePositives} report(s) match no planted error` });
  if (m.attributes) out.push({ label: "Attributes", value: `${pct(m.attributes.setRate)} set`, note: `${pct(m.attributes.matchRate)} agree with the reference` });
  if (m.checkpoints) out.push({ label: "Checkpoints", value: `${m.checkpoints.done} / ${m.checkpoints.total}`, note: m.checkpoints.done < m.checkpoints.total ? "Some checkpoints not completed" : "All checkpoints completed" });
  if (m.answers) out.push({ label: "Questions answered", value: `${m.answers.provided} / ${m.answers.total}`, note: "Answers still need reading by the reviewer" });
  out.push({ label: "Flags raised", value: String(m.flags), note: "Trainee-raised uncertainty flags" });
  return out;
}
