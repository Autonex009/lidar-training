export type UpAxis = "Z" | "Y";
export type Vec3 = [number, number, number];

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface PointLabels {
  semantic: Uint16Array;
  instance: Uint16Array;
}

/** Normalized in-memory point cloud, shared by parsers, cache, synthetic generator and viewer. */
export interface NormalizedCloud {
  pointCount: number;
  /** xyz interleaved, native frame of the asset. */
  positions: Float32Array;
  /** rgb interleaved, 0..255. */
  colors?: Uint8Array;
  intensity?: Float32Array;
  /** Per-point ground-truth labels (synthetic assets only). */
  labels?: PointLabels;
  upAxis: UpAxis;
  bounds: Bounds;
  frameIndex?: number;
  metadata: Record<string, unknown>;
}

export type PointCloudFormat = "ply" | "pcd" | "xyz" | "pts" | "las" | "laz" | "bin";

export type ScalarType = "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "float32" | "float64";

export interface RecordSchema {
  fields: { name: string; type: ScalarType }[];
  byteOrder: "little" | "big";
}

export class PointCloudParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PointCloudParseError";
  }
}
