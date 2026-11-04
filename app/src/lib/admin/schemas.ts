import { z } from "zod";

/** Known track keys (Learn optional tracks). Modules/tasks carry these as trackKey. */
export const TRACKS: { key: string; label: string }[] = [
  { key: "cuboid", label: "Cuboid detection" },
  { key: "semantic_seg", label: "Semantic segmentation" },
  { key: "instance_seg", label: "Instance segmentation" },
  { key: "tracking", label: "Multi-frame tracking" },
  { key: "scene_classification", label: "Scene classification" },
  { key: "sensor_fusion", label: "Sensor fusion / context images" },
];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be #rrggbb");
const key = z.string().trim().min(1).max(80);

export const classSchema = z.looseObject({
  name: z.string().trim().min(1).max(120),
  key: key.optional(),
  color: hex.optional(),
  defaultDims: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).optional(),
});

export const attributeSchema = z.looseObject({
  key,
  name: z.string().trim().min(1).max(120),
  type: z.enum(["single_select", "multi_select", "boolean", "text", "number"]),
  required: z.boolean().default(false),
  appliesTo: z.union([z.literal("all"), z.array(z.string())]).default("all"),
  options: z.array(z.looseObject({ key, name: z.string().trim().min(1) })).default([]),
});

export const labelSchemaSchema = z.looseObject({
  classes: z.array(classSchema),
  attributes: z.array(attributeSchema).default([]),
}).superRefine((v, ctx) => {
  const names = new Set<string>();
  v.classes.forEach((c, i) => {
    if (names.has(c.name)) ctx.addIssue({ code: "custom", path: ["classes", i, "name"], message: `Duplicate class "${c.name}"` });
    names.add(c.name);
  });
  const keys = new Set<string>();
  v.attributes.forEach((a, i) => {
    if (keys.has(a.key)) ctx.addIssue({ code: "custom", path: ["attributes", i, "key"], message: `Duplicate attribute key "${a.key}"` });
    keys.add(a.key);
    if ((a.type === "single_select" || a.type === "multi_select") && a.options.length === 0)
      ctx.addIssue({ code: "custom", path: ["attributes", i, "options"], message: `Attribute "${a.key}" needs options` });
  });
});

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const refCuboid = z.looseObject({ id: z.string().min(1), label: z.string().min(1), center: vec3, dims: vec3, yaw: z.number(), trackId: z.number().optional(), attributes: z.record(z.string(), z.unknown()).optional() });

/** Hidden reference annotation (neutral format used by metrics). */
export const referenceSchema = z.looseObject({
  cuboids: z.array(refCuboid),
  frames: z.array(z.looseObject({ index: z.number().int().min(0), cuboids: z.array(refCuboid) })).optional(),
  pointLabels: z.looseObject({ semanticB64: z.string().optional(), instanceB64: z.string().optional(), classMap: z.record(z.string(), z.string()).optional() }).optional(),
});

const checkpoint = z.looseObject({ key, label: z.string(), kind: z.enum(["control_used", "preset_viewed", "region_located"]) });
const question = z.looseObject({ key, prompt: z.string(), kind: z.enum(["free_text", "single_select"]), options: z.array(z.string()).optional() });
const errTag = z.looseObject({ key, name: z.string(), description: z.string().default("") });

/** `Task.config` sub-blocks editable as JSON (requiredOutput + reviewerErrorTags are edited as structured fields). */
export const taskConfigBlocksSchema = z.looseObject({
  sceneKey: z.string().optional(),
  labelSchemaOverride: z.array(z.string()).nullable().optional(),
  requiredAttributes: z.array(z.string()).optional(),
  inspection: z.object({ checkpoints: z.array(checkpoint), questions: z.array(question) }).nullable().optional(),
  identification: z.looseObject({ targets: z.array(z.object({ refCuboidId: z.string(), hint: z.string() })), questions: z.array(question) }).nullable().optional(),
  errorDetection: z.object({ plantedErrorCount: z.number().int().min(0), errorTags: z.array(errTag) }).nullable().optional(),
  plantedErrors: z.array(z.looseObject({ type: z.string(), cuboidId: z.string() })).optional(),
  classIds: z.record(z.string(), z.number().int()).optional(),
  classMapping: z.record(z.string(), z.string()).nullable().optional(),
});

export const scoringCriteriaSchema = z.looseObject({
  autoMetrics: z.array(z.string()),
  thresholds: z.record(z.string(), z.number()).optional(),
  reviewerWeight: z.number().min(0).max(1),
});

export const rubricRowSchema = z.looseObject({
  key,
  name: z.string().trim().min(1),
  description: z.string().default(""),
  weight: z.number().min(0).max(100),
});
export const errorTagRowSchema = z.object({ key, name: z.string().trim().min(1), description: z.string().default("") });
