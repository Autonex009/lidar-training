import { mulberry32 } from "../synthetic/prng";
import { computeBounds } from "./parsers/common";
import type { NormalizedCloud } from "./types";

/** Deterministic uniform subsample (selection sampling, preserves point order). */
export function subsample(cloud: NormalizedCloud, maxPoints: number, seed = 1): NormalizedCloud {
  const n = cloud.pointCount;
  if (n <= maxPoints) return cloud;
  const rng = mulberry32(seed);
  const idx = new Uint32Array(maxPoints);
  let need = maxPoints, k = 0;
  for (let i = 0; i < n && need > 0; i++) {
    if (rng() * (n - i) < need) { idx[k++] = i; need--; }
  }
  const positions = new Float32Array(maxPoints * 3);
  const colors = cloud.colors ? new Uint8Array(maxPoints * 3) : undefined;
  const intensity = cloud.intensity ? new Float32Array(maxPoints) : undefined;
  const sem = cloud.labels ? new Uint16Array(maxPoints) : undefined;
  const inst = cloud.labels ? new Uint16Array(maxPoints) : undefined;
  for (let j = 0; j < maxPoints; j++) {
    const i = idx[j];
    positions[j * 3] = cloud.positions[i * 3]; positions[j * 3 + 1] = cloud.positions[i * 3 + 1]; positions[j * 3 + 2] = cloud.positions[i * 3 + 2];
    if (colors && cloud.colors) { colors[j * 3] = cloud.colors[i * 3]; colors[j * 3 + 1] = cloud.colors[i * 3 + 1]; colors[j * 3 + 2] = cloud.colors[i * 3 + 2]; }
    if (intensity && cloud.intensity) intensity[j] = cloud.intensity[i];
    if (sem && inst && cloud.labels) { sem[j] = cloud.labels.semantic[i]; inst[j] = cloud.labels.instance[i]; }
  }
  return {
    ...cloud,
    pointCount: maxPoints,
    positions, colors, intensity,
    labels: sem && inst ? { semantic: sem, instance: inst } : undefined,
    bounds: computeBounds(positions, maxPoints),
    metadata: { ...cloud.metadata, originalPointCount: n, subsampled: true, subsampleSeed: seed },
  };
}
