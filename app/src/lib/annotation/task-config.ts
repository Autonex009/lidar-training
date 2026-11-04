import type { Vec3 } from "./types";

export interface AttrOption { key: string; name: string }
export interface AttrDef { key: string; name: string; required: boolean; appliesTo: "all" | string[]; options: AttrOption[] }
export interface ClassDef { name: string; classId?: number }

export interface CheckpointDef { key: string; label: string; kind: "control_used" | "preset_viewed" | "region_located"; control?: string; preset?: string; region?: { center: Vec3; radiusM: number } }
export interface QuestionDef { key: string; prompt: string; kind: "free_text" | "single_select"; options?: string[] }
export interface ErrorTagDef { key: string; name: string; description: string }

/** Everything the validator needs (a subset of the runtime task). */
export interface TaskRules {
  annotationType: "INSPECTION" | "IDENTIFICATION" | "CUBOID" | "SEMANTIC_SEG" | "INSTANCE_SEG" | "TRACKING" | "ERROR_DETECTION" | "MIXED";
  classes: string[];
  /** Attribute keys required on every cuboid (already filtered to those defined). */
  requiredAttributes: string[];
  attributes: AttrDef[];
  checkpoints?: CheckpointDef[];
  questions?: QuestionDef[];
  identificationTargets?: { refCuboidId: string }[];
  labelDefaults?: Record<string, Vec3>;
}

/** Default attributes when a program defines none (foundations). */
export const DEFAULT_ATTRIBUTES: AttrDef[] = [
  { key: "occlusion", name: "Occlusion", required: false, appliesTo: "all", options: [{ key: "none", name: "None" }, { key: "partial", name: "Partial" }, { key: "heavy", name: "Heavy" }] },
];

/** Typical dimensions [l, w, h] used for default height and size warnings. Keyed by lower-case class name. */
export const CLASS_DEFAULT_DIMS: Record<string, Vec3> = {
  vehicle: [4.5, 1.9, 1.5], pedestrian: [0.6, 0.6, 1.75], cyclist: [1.8, 0.7, 1.7], pole: [0.3, 0.3, 5],
  human: [0.6, 0.6, 1.75], forklift: [4.5, 1.9, 1.5], "agv / amr": [4.5, 1.9, 1.5], cart: [1.8, 0.7, 1.7], "safety barrier": [0.3, 0.3, 5],
};

export const defaultDimsFor = (label: string): Vec3 | undefined => CLASS_DEFAULT_DIMS[label.toLowerCase()];

/** Does an attribute apply to a class? appliesTo lists class keys/names, compared case-insensitively. */
export function attrApplies(a: AttrDef, label: string): boolean {
  if (a.appliesTo === "all") return true;
  const l = label.toLowerCase();
  return a.appliesTo.some((x) => x.toLowerCase() === l);
}

export const PLANTED_TO_TAG: Record<string, string> = {
  wrong_class: "wrong_class", bad_yaw: "yaw_misaligned", missing_object: "missing_object", duplicate: "duplicate", wrong_dims: "box_too_large",
};

export const UNLABELED_ID = 0;
