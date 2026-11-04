import fs from "node:fs";
import path from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import { foundationTasks, tonicTasks, sceneClassMapping, type TaskTemplateContent } from "@/content/tasks";
import { getDemoScene } from "@/lib/synthetic/scenes";
import { demoAssetDir } from "@/lib/synthetic/assets-io";
import type { ReferenceCuboid } from "@/lib/synthetic/types";
import { CLASS_IDS } from "@/lib/synthetic/types";
import { ensureAssignmentsForProgram } from "./assignments";

interface RefFile {
  cuboids: ReferenceCuboid[];
  frames?: { index: number; cuboids: ReferenceCuboid[] }[];
  pointLabels?: { semanticB64: string; instanceB64: string; classMap: Record<string, string> };
}

const loadReference = (sceneKey: string): RefFile =>
  JSON.parse(fs.readFileSync(path.join(demoAssetDir(sceneKey), "reference.json"), "utf8")) as RefFile;

/** Translate (when a mapping applies), filter to allowed classes, derive Motion for Tonic. */
function transform(list: ReferenceCuboid[], allowed: string[] | undefined, mapping: Record<string, string> | null, movingIds: Set<string>, withMotion: boolean): ReferenceCuboid[] {
  const out: ReferenceCuboid[] = [];
  for (const c of list) {
    let label = c.label;
    if (mapping) {
      if (!mapping[label]) continue;
      label = mapping[label];
    }
    if (allowed && !allowed.includes(label)) continue;
    const attributes: ReferenceCuboid["attributes"] = { ...c.attributes };
    if (withMotion) attributes.motion = movingIds.has(c.id) ? "moving" : "static";
    out.push({ ...c, label, attributes, center: [...c.center], dims: [...c.dims] });
  }
  return out;
}

export interface BuiltTask {
  data: Omit<Prisma.TaskTemplateUncheckedCreateInput, "programId" | "assetId" | "prerequisiteTaskId">;
  prerequisiteCode?: string;
  sceneKey: string;
}

export function buildTaskData(t: TaskTemplateContent, isTonic: boolean): BuiltTask {
  const scene = getDemoScene(t.sceneKey);
  const movingIds = new Set(scene.spec.objects.filter((o) => o.velocity).map((o) => `cub-${o.instanceId}`));
  const mapping = isTonic ? sceneClassMapping[t.sceneKey] ?? null : null;
  const ref = loadReference(t.sceneKey);
  const tx = (l: ReferenceCuboid[]) => transform(l, t.labelSchemaOverride, mapping, movingIds, isTonic);

  const reference: Record<string, unknown> = { cuboids: tx(ref.cuboids) };
  if (ref.frames) reference.frames = ref.frames.map((f) => ({ index: f.index, cuboids: tx(f.cuboids) }));
  const isSeg = t.annotationType === "SEMANTIC_SEG" || t.annotationType === "INSTANCE_SEG";
  if (isSeg && ref.pointLabels) reference.pointLabels = ref.pointLabels;

  let initial: unknown = null;
  if (t.useInitialAnnotation && scene.initialAnnotation) initial = { cuboids: tx(scene.initialAnnotation).map((c) => ({ ...c, attributes: {} })) };
  if (t.annotationType === "IDENTIFICATION" && t.identification) {
    const ids = new Set(t.identification.targets.map((x) => x.refCuboidId));
    // geometry only: labels are hidden behind "?"
    initial = { cuboids: (reference.cuboids as ReferenceCuboid[]).filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, label: "?", center: c.center, dims: c.dims, yaw: c.yaw, attributes: {} })) };
  }

  const classIds: Record<string, number> = {};
  if (isSeg) for (const n of t.labelSchemaOverride ?? []) if (n in CLASS_IDS) classIds[n] = CLASS_IDS[n as keyof typeof CLASS_IDS];

  const config = {
    sceneKey: t.sceneKey,
    requiredOutput: t.requiredOutput,
    labelSchemaOverride: t.labelSchemaOverride ?? null,
    requiredAttributes: t.requiredAttributes ?? [],
    inspection: t.inspection ?? null,
    identification: t.identification ?? null,
    errorDetection: t.errorDetection ?? null,
    plantedErrors: scene.plantedErrors ?? [],
    classIds,
    classMapping: mapping,
  };

  return {
    prerequisiteCode: t.prerequisiteCode,
    sceneKey: t.sceneKey,
    data: {
      code: t.code,
      title: t.title,
      description: t.description,
      objective: t.objective,
      learningOutcome: t.learningOutcome,
      difficulty: t.difficulty,
      annotationType: t.annotationType,
      estimatedMinutes: t.estimatedMinutes,
      instructions: t.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      expectedOutput: t.expectedOutput,
      scoringCriteria: t.scoringCriteria as unknown as Prisma.InputJsonValue,
      referenceAnnotation: reference as unknown as Prisma.InputJsonValue,
      initialAnnotation: (initial ?? undefined) as Prisma.InputJsonValue | undefined,
      commonMistakes: t.commonMistakes,
      hints: t.hints,
      reviewerRubric: t.reviewerRubric as unknown as Prisma.InputJsonValue,
      isRequiredForCertification: t.isRequiredForCertification,
      trackKey: t.trackKey ?? null,
      order: t.order,
      config: { ...config, reviewerErrorTags: t.reviewerErrorTags } as unknown as Prisma.InputJsonValue,
    },
  };
}

/** Upsert templates for one program (keyed by code), resolve prerequisites, and create assignments for enrolled users. */
export async function seedTaskTemplates(prisma: PrismaClient, programSlug: string, tasks: TaskTemplateContent[], isTonic: boolean) {
  const program = await prisma.trainingProgram.findUnique({ where: { slug: programSlug } });
  if (!program) return 0;
  const tracks = Array.isArray(program.enabledTracks) ? (program.enabledTracks as string[]) : [];
  const built = tasks.map((t) => buildTaskData(t, isTonic));
  const ids = new Map<string, string>();
  for (const b of built) {
    const asset = await prisma.pointCloudAsset.findFirst({ where: { cachePath: b.sceneKey } });
    if (!asset) throw new Error(`No asset for scene ${b.sceneKey}`);
    const isPublished = b.data.trackKey ? tracks.includes(b.data.trackKey) : true;
    const data = { ...b.data, programId: program.id, assetId: asset.id, isPublished, initialAnnotation: b.data.initialAnnotation ?? Prisma.DbNull };
    const row = await prisma.taskTemplate.upsert({ where: { code: b.data.code }, create: data, update: data });
    ids.set(b.data.code, row.id);
  }
  for (const b of built) {
    await prisma.taskTemplate.update({ where: { code: b.data.code }, data: { prerequisiteTaskId: b.prerequisiteCode ? ids.get(b.prerequisiteCode) ?? null : null } });
  }
  await ensureAssignmentsForProgram(prisma, program.id);
  return built.length;
}

export const seedFoundationTasks = (prisma: PrismaClient) => seedTaskTemplates(prisma, "foundations", foundationTasks, false);
export const seedTonicTasks = (prisma: PrismaClient) => seedTaskTemplates(prisma, "tonic", tonicTasks, true);
