import { PointCloudParseError, type NormalizedCloud, type PointCloudFormat, type RecordSchema } from "./types";
import { asUint8 } from "./parsers/common";
import { parsePly } from "./parsers/ply";
import { parsePcd } from "./parsers/pcd";
import { parseXyz } from "./parsers/xyz";
import { parseLas } from "./parsers/las";
import { parseBin } from "./parsers/bin";

export * from "./types";
export { subsample } from "./subsample";
export { KITTI_XYZI, BIN_PRESETS } from "./parsers/bin";

export interface ParseOptions {
  format: PointCloudFormat;
  recordSchema?: RecordSchema;
}

export function parsePointCloud(buffer: ArrayBuffer | Uint8Array, opts: ParseOptions): NormalizedCloud {
  const u8 = asUint8(buffer);
  switch (opts.format) {
    case "ply": return parsePly(u8);
    case "pcd": return parsePcd(u8);
    case "xyz":
    case "pts": return parseXyz(u8);
    case "las": return parseLas(u8);
    case "laz": throw new PointCloudParseError("LAZ not supported, decompress to LAS first");
    case "bin": return parseBin(u8, opts.recordSchema);
    default: throw new PointCloudParseError(`Unsupported format "${String(opts.format)}"`);
  }
}

export function detectFormat(filename: string): PointCloudFormat | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, PointCloudFormat> = { ply: "ply", pcd: "pcd", xyz: "xyz", txt: "xyz", pts: "pts", las: "las", laz: "laz", bin: "bin" };
  return map[ext] ?? null;
}
