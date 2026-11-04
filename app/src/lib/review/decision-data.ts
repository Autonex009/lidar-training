/**
 * `ReviewDecision.errorTags` is a Json column (schema is frozen in Stage 5), so it carries both the reviewer's error
 * tags and the per-criterion rubric scores:
 *
 *   { "tags": ["box_too_large"], "rubric": { "box_fit": 50 } }
 *
 * Legacy rows (Stage 4 tests) stored a bare string array; `parseDecisionData` accepts both.
 */
export interface DecisionData { tags: string[]; rubric: Record<string, number> }

export function packDecisionData(d: DecisionData): DecisionData {
  return { tags: d.tags, rubric: d.rubric };
}

export function parseDecisionData(raw: unknown): DecisionData {
  if (Array.isArray(raw)) return { tags: raw.filter((x): x is string => typeof x === "string"), rubric: {} };
  if (raw && typeof raw === "object") {
    const o = raw as { tags?: unknown; rubric?: unknown };
    const tags = Array.isArray(o.tags) ? o.tags.filter((x): x is string => typeof x === "string") : [];
    const rubric: Record<string, number> = {};
    if (o.rubric && typeof o.rubric === "object") for (const [k, v] of Object.entries(o.rubric)) if (typeof v === "number") rubric[k] = v;
    return { tags, rubric };
  }
  return { tags: [], rubric: {} };
}
