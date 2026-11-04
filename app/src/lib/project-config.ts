import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const imageRef = z.object({ file: z.string(), caption: z.string().optional() });

export const projectConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i),
  name: z.string().min(1),
  description: z.string().default(""),
  source: z.object({ file: z.string(), extracted: z.string().optional() }).optional(),
  annotationTypes: z.array(z.string()).default([]),
  enabledTracks: z.array(z.string()).default([]),
  navigationProfile: z.enum(["orbit", "fly"]).default("orbit"),
  coordinate: z
    .object({
      upAxis: z.enum(["Z", "Y"]).default("Z"),
      yawConvention: z.string().default("CCW_ABOUT_UP"),
      boxDefinition: z.string().default("CENTER_DIMS_YAW"),
      lengthAxis: z.string().optional(),
      heightAxis: z.string().optional(),
    })
    .default({ upAxis: "Z", yawConvention: "CCW_ABOUT_UP", boxDefinition: "CENTER_DIMS_YAW" }),
  passingScore: z.number().min(0).max(100).default(80),
  roi: z
    .array(z.object({ key: z.string(), rangeM: z.tuple([z.number(), z.number().nullable()]), requirement: z.string() }))
    .default([]),
  labelSchema: z.object({
    groups: z.array(z.object({ key: z.string(), name: z.string(), classes: z.array(z.string()) })).default([]),
    classes: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        group: z.string().optional(),
        classId: z.number().int(),
        definition: z.string().default(""),
        cuboidRules: z.array(z.string()).default([]),
        images: z.array(imageRef).default([]),
        attributes: z.array(z.string()).default([]),
      }),
    ),
  }),
  attributes: z
    .array(
      z.object({
        key: z.string(),
        name: z.string(),
        type: z.string(),
        required: z.boolean().default(false),
        appliesTo: z.union([z.literal("all"), z.array(z.string())]).default("all"),
        options: z.array(z.object({ key: z.string(), name: z.string(), description: z.string().optional() })).default([]),
      }),
    )
    .default([]),
  trackId: z.object({ required: z.boolean(), type: z.string(), rules: z.array(z.string()).default([]) }).optional(),
  generalRules: z.array(z.string()).default([]),
  requiredFieldsPerObject: z.array(z.string()).default([]),
  preLabels: z.object({ rules: z.array(z.string()).default([]) }).optional(),
  imageAlignment: z.object({ rules: z.array(z.string()).default([]) }).optional(),
  referenceVideos: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
  commonMistakes: z.array(z.string()).default([]),
  quizSeeds: z
    .array(
      z.object({
        kind: z.string(),
        prompt: z.string(),
        options: z.array(z.string()).default([]),
        correctAnswer: z.number(),
        explanation: z.string().default(""),
        imageFile: z.string().optional(),
      }),
    )
    .default([]),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

/** Repo-root `project-configs/` (app lives in <root>/app). Override with PROJECT_CONFIGS_DIR. */
export function projectConfigsRoot(): string {
  return process.env.PROJECT_CONFIGS_DIR ?? path.resolve(process.cwd(), "..", "project-configs");
}

export function loadProjectConfigs(root = projectConfigsRoot()): ProjectConfig[] {
  if (!fs.existsSync(root)) return [];
  const out: ProjectConfig[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, "config.json");
    if (!fs.existsSync(file)) continue;
    const parsed = projectConfigSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
    if (!parsed.success) throw new Error(`Invalid project config ${entry.name}: ${parsed.error.message}`);
    if (parsed.data.slug !== entry.name) throw new Error(`Project config slug "${parsed.data.slug}" does not match folder "${entry.name}"`);
    out.push(parsed.data);
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
