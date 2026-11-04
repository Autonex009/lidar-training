import type { AnnotationType, TaskTemplate, TrainingProgram } from "@prisma/client";
import { CLASS_IDS } from "@/lib/synthetic/types";
import { DEFAULT_ATTRIBUTES, defaultDimsFor, type AttrDef, type CheckpointDef, type ClassDef, type ErrorTagDef, type QuestionDef, type TaskRules } from "@/lib/annotation/task-config";
import type { Vec3 } from "@/lib/annotation/types";

export interface TaskConfigJson {
  sceneKey?: string;
  requiredOutput?: string[];
  labelSchemaOverride?: string[] | null;
  requiredAttributes?: string[];
  inspection?: { checkpoints: CheckpointDef[]; questions: QuestionDef[] } | null;
  identification?: { targets: { refCuboidId: string; hint: string }[]; questions: QuestionDef[] } | null;
  errorDetection?: { plantedErrorCount: number; errorTags: ErrorTagDef[] } | null;
  plantedErrors?: { type: string; cuboidId: string; description?: string }[];
  classIds?: Record<string, number>;
  reviewerErrorTags?: ErrorTagDef[];
}

/** Client-safe task view: never contains the reference annotation or planted-error answers. */
export interface WorkspaceTask {
  id: string;
  code: string;
  title: string;
  description: string;
  objective: string;
  instructions: string[];
  requiredOutput: string[];
  expectedOutput: string;
  hints: string[];
  commonMistakes: string[];
  annotationType: AnnotationType;
  classes: (ClassDef & { classId: number; defaultDims?: Vec3 })[];
  attributes: AttrDef[];
  requiredAttributes: string[];
  checkpoints: CheckpointDef[];
  questions: QuestionDef[];
  targets: { refCuboidId: string; hint: string }[];
  errorTags: ErrorTagDef[];
  asset: { id: string; frameCount: number; upAxis: "Z" | "Y"; isSynthetic: boolean; name: string };
  program: { navigationProfile: "orbit" | "fly"; upAxis: "Z" | "Y" };
}

interface SchemaShape { classes?: { name: string; classId?: number }[]; attributes?: { key: string; name: string; required?: boolean; appliesTo?: "all" | string[]; options?: { key: string; name: string }[] }[] }

export function buildWorkspaceTask(
  task: TaskTemplate,
  program: Pick<TrainingProgram, "labelSchema" | "navigationProfile" | "upAxis">,
  asset: { id: string; frameCount: number; upAxis: string; isSynthetic: boolean; name: string },
): WorkspaceTask {
  const cfg = (task.config ?? {}) as TaskConfigJson;
  const schema = (program.labelSchema ?? {}) as SchemaShape;
  const names = cfg.labelSchemaOverride ?? (schema.classes ?? []).map((c) => c.name);
  const classes = names.map((name, i) => {
    const sc = schema.classes?.find((c) => c.name === name);
    return { name, classId: sc?.classId ?? (CLASS_IDS as Record<string, number>)[name] ?? i + 1, defaultDims: defaultDimsFor(name) };
  });
  const attributes: AttrDef[] = schema.attributes?.length
    ? schema.attributes.map((a) => ({ key: a.key, name: a.name, required: Boolean(a.required), appliesTo: a.appliesTo ?? "all", options: (a.options ?? []).map((o) => ({ key: o.key, name: o.name })) }))
    : DEFAULT_ATTRIBUTES;
  const requiredAttributes = (cfg.requiredAttributes ?? []).filter((k) => attributes.some((a) => a.key === k));
  return {
    id: task.id, code: task.code, title: task.title, description: task.description, objective: task.objective,
    instructions: task.instructions.split("\n").filter(Boolean),
    requiredOutput: cfg.requiredOutput ?? [], expectedOutput: task.expectedOutput,
    hints: Array.isArray(task.hints) ? (task.hints as string[]) : [],
    commonMistakes: Array.isArray(task.commonMistakes) ? (task.commonMistakes as string[]) : [],
    annotationType: task.annotationType,
    classes, attributes, requiredAttributes,
    checkpoints: cfg.inspection?.checkpoints ?? [],
    questions: [...(cfg.inspection?.questions ?? []), ...(cfg.identification?.questions ?? [])],
    targets: cfg.identification?.targets ?? [],
    errorTags: cfg.errorDetection?.errorTags ?? [],
    asset: { id: asset.id, frameCount: asset.frameCount, upAxis: asset.upAxis === "Y" ? "Y" : "Z", isSynthetic: asset.isSynthetic, name: asset.name },
    program: { navigationProfile: program.navigationProfile === "fly" ? "fly" : "orbit", upAxis: program.upAxis === "Y" ? "Y" : "Z" },
  };
}

export function rulesFromTask(t: WorkspaceTask): TaskRules {
  return {
    annotationType: t.annotationType, classes: t.classes.map((c) => c.name), requiredAttributes: t.requiredAttributes, attributes: t.attributes,
    checkpoints: t.checkpoints, questions: t.questions, identificationTargets: t.targets,
  };
}
