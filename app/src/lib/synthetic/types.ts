import type { NormalizedCloud } from "../pointcloud/types";

export type ObjectKind = "box" | "cylinder" | "capsule" | "wedge" | "lshape";

export const CLASS_IDS = {
  Unlabeled: 0, Ground: 1, Vehicle: 2, Pedestrian: 3, Cyclist: 4, Pole: 5, Building: 6, Vegetation: 7, Unknown: 8,
} as const;
export type ClassName = keyof typeof CLASS_IDS;
export const CLASS_MAP: Record<number, string> = Object.fromEntries(Object.entries(CLASS_IDS).map(([k, v]) => [v, k]));

export interface ObjectSpec {
  kind: ObjectKind;
  label: ClassName;
  instanceId: number;
  trackId?: number;
  /** Ground position [x, y]; the object base sits at z = 0. */
  center: [number, number];
  /** [length (along heading), width, height] */
  dims: [number, number, number];
  yaw: number;
  /** Per-frame translation. */
  velocity?: [number, number];
  /** 0..1: fraction of the object (on the side facing away from the sensor) with no points. */
  occlusionFraction?: number;
  /** 0..1 multiplier on point density. */
  sparsity?: number;
  /** Frames in which the object is absent. */
  hiddenFrames?: number[];
}

export interface SceneSpec {
  seed: number;
  extent: [number, number];
  groundNoise: number;
  /** Global density multiplier (1 ~ 29k ground points on a 60x60 scene). */
  density: number;
  objects: ObjectSpec[];
  walls?: boolean;
  frames?: number;
}

export interface ReferenceCuboid {
  id: string;
  trackId?: number;
  label: string;
  center: [number, number, number];
  dims: [number, number, number];
  yaw: number;
  attributes: { occlusion?: "none" | "partial" | "heavy" } & Record<string, unknown>;
}

export interface ReferenceAnnotation {
  cuboids: ReferenceCuboid[];
  pointLabels?: { semantic: Uint16Array; instance: Uint16Array; classMap: Record<number, string> };
  frames?: { index: number; cuboids: ReferenceCuboid[] }[];
}

export interface GeneratedScene {
  cloud: NormalizedCloud;
  /** All frames (frames[0] === cloud). */
  frames: NormalizedCloud[];
  reference: ReferenceAnnotation;
}
