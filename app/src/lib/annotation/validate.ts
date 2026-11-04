import { allCuboids, b64ToU16, type AnnotationDocument } from "./types";
import { attrApplies, defaultDimsFor, type TaskRules } from "./task-config";

export interface Issue { code: string; message: string; cuboidId?: string; frame?: number }
export interface ValidationResult { errors: Issue[]; warnings: Issue[]; ok: boolean }

const CUBOID_TYPES = new Set(["CUBOID", "MIXED", "TRACKING"]);
const isSeg = (t: string) => t === "SEMANTIC_SEG" || t === "INSTANCE_SEG";

/** Pure submit validation. Errors block submission; warnings do not. */
export function validateForSubmit(doc: AnnotationDocument, task: TaskRules): ValidationResult {
  const errors: Issue[] = [], warnings: Issue[] = [];
  const type = task.annotationType;
  const cubs = allCuboids(doc);

  if (CUBOID_TYPES.has(type) && cubs.length < 1) errors.push({ code: "no_cuboids", message: "Add at least one cuboid." });

  if (CUBOID_TYPES.has(type) || type === "ERROR_DETECTION") {
    for (const { frame, cuboid } of cubs) {
      if (!cuboid.label || cuboid.label === "?") errors.push({ code: "no_label", message: `A cuboid has no label${frameSuffix(task, frame)}.`, cuboidId: cuboid.id, frame });
      if (cuboid.dims.some((d) => !(d > 0))) errors.push({ code: "bad_dims", message: `A ${cuboid.label || "cuboid"} has a non-positive dimension.`, cuboidId: cuboid.id, frame });
      if (type !== "ERROR_DETECTION") {
        for (const key of task.requiredAttributes) {
          const def = task.attributes.find((a) => a.key === key);
          if (!def || !attrApplies(def, cuboid.label)) continue;
          if (!cuboid.attributes[key]) errors.push({ code: "missing_attribute", message: `${cuboid.label || "Cuboid"} is missing required attribute "${def.name}"${frameSuffix(task, frame)}.`, cuboidId: cuboid.id, frame });
        }
      }
      const d = defaultDimsFor(cuboid.label);
      if (d && cuboid.dims.every((x) => x > 0)) {
        const ratio = (cuboid.dims[0] * cuboid.dims[1] * cuboid.dims[2]) / (d[0] * d[1] * d[2]);
        if (ratio > 3) warnings.push({ code: "large_box", message: `${cuboid.label} box is very large for its class (${ratio.toFixed(1)}x typical volume).`, cuboidId: cuboid.id, frame });
        else if (ratio < 0.2) warnings.push({ code: "small_box", message: `${cuboid.label} box is very small for its class (${(ratio * 100).toFixed(0)}% of typical volume).`, cuboidId: cuboid.id, frame });
      }
    }
  }

  if (type === "TRACKING") {
    for (const [f, fa] of Object.entries(doc.frames)) {
      const seen = new Map<number, number>();
      for (const c of fa.cuboids) {
        if (c.trackId === undefined) { errors.push({ code: "no_track", message: `A ${c.label || "cuboid"} in frame ${Number(f) + 1} has no track ID.`, cuboidId: c.id, frame: Number(f) }); continue; }
        seen.set(c.trackId, (seen.get(c.trackId) ?? 0) + 1);
      }
      for (const [tid, n] of seen) if (n > 1) errors.push({ code: "duplicate_track", message: `Track ID ${tid} is used ${n} times in frame ${Number(f) + 1}.`, frame: Number(f) });
    }
  }

  if (type === "INSPECTION") {
    for (const cp of task.checkpoints ?? []) if (!doc.checkpoints[cp.key]) errors.push({ code: "checkpoint_missing", message: `Checkpoint not completed: ${cp.label}.` });
  }

  if (type === "IDENTIFICATION") {
    const flagged = new Set(doc.flags.filter((f) => f.cuboidId && f.reason.trim()).map((f) => f.cuboidId));
    const first = cubs.filter((c) => c.frame === 0).map((c) => c.cuboid);
    for (const c of first) {
      if ((!c.label || c.label === "?") && !flagged.has(c.id)) errors.push({ code: "unidentified", message: "An object has no class and no uncertainty flag.", cuboidId: c.id });
    }
    if (first.length === 0) errors.push({ code: "no_cuboids", message: "No objects to identify were loaded." });
  }

  for (const q of task.questions ?? []) {
    const a = doc.answers[q.key];
    if (a === undefined || String(a).trim() === "") errors.push({ code: "unanswered", message: `Unanswered question: ${truncate(q.prompt, 70)}` });
  }

  if (type === "ERROR_DETECTION" && (doc.errorsFound?.length ?? 0) === 0) errors.push({ code: "no_errors_reported", message: "Report at least one error you found." });

  if (isSeg(type)) {
    let labeled = 0;
    for (const pl of doc.pointLabels ?? []) {
      const arr = pl.semantic ? b64ToU16(pl.semantic) : pl.instance ? b64ToU16(pl.instance) : null;
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) labeled++;
    }
    if (labeled === 0) errors.push({ code: "no_points", message: "Label some points before submitting." });
  }

  if (doc.flags.length) warnings.push({ code: "flags_present", message: `${doc.flags.length} flag${doc.flags.length === 1 ? "" : "s"} will be sent to the reviewer.` });
  for (const f of doc.flags) if (!f.reason.trim()) errors.push({ code: "flag_no_reason", message: "A flag has no reason." });

  return { errors, warnings, ok: errors.length === 0 };
}

const frameSuffix = (task: TaskRules, frame: number) => (task.annotationType === "TRACKING" ? ` in frame ${frame + 1}` : "");
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
