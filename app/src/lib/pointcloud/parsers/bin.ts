import { PointCloudParseError, type NormalizedCloud, type RecordSchema, type ScalarType } from "../types";
import { PointBuilder, SCALAR_SIZE, dataView, readScalar } from "./common";

const TYPES = Object.keys(SCALAR_SIZE) as ScalarType[];

export const KITTI_XYZI: RecordSchema = {
  byteOrder: "little",
  fields: [
    { name: "x", type: "float32" }, { name: "y", type: "float32" },
    { name: "z", type: "float32" }, { name: "intensity", type: "float32" },
  ],
};

export const BIN_PRESETS: Record<string, RecordSchema> = { KITTI_XYZI };

export function validateRecordSchema(schema: unknown): RecordSchema {
  const s = schema as RecordSchema | undefined;
  if (!s || !Array.isArray(s.fields) || s.fields.length === 0) throw new PointCloudParseError("BIN: recordSchema.fields is required");
  if (s.byteOrder !== "little" && s.byteOrder !== "big") throw new PointCloudParseError("BIN: recordSchema.byteOrder must be 'little' or 'big'");
  for (const f of s.fields) {
    if (!f || typeof f.name !== "string" || !TYPES.includes(f.type)) throw new PointCloudParseError(`BIN: invalid field ${JSON.stringify(f)}`);
  }
  const names = s.fields.map((f) => f.name);
  for (const a of ["x", "y", "z"]) if (!names.includes(a)) throw new PointCloudParseError(`BIN: recordSchema must include field "${a}"`);
  return s;
}

export function parseBin(u8: Uint8Array, schema?: RecordSchema): NormalizedCloud {
  if (!schema) throw new PointCloudParseError("BIN requires a recordSchema; refusing to guess the record layout");
  const s = validateRecordSchema(schema);
  const offs: number[] = [];
  let rec = 0;
  for (const f of s.fields) { offs.push(rec); rec += SCALAR_SIZE[f.type]; }
  if (u8.length % rec !== 0) throw new PointCloudParseError(`BIN: file size ${u8.length} is not a multiple of record size ${rec}`);
  const n = u8.length / rec;
  const idx = (names: string[]) => s.fields.findIndex((f) => names.includes(f.name));
  const ix = idx(["x"]), iy = idx(["y"]), iz = idx(["z"]), ii = idx(["intensity", "i", "reflectance"]);
  const ir = idx(["r", "red"]), ig = idx(["g", "green"]), ib = idx(["b", "blue"]);
  const hasColor = ir >= 0 && ig >= 0 && ib >= 0;
  const little = s.byteOrder === "little";
  const dv = dataView(u8);
  const rd = (base: number, k: number) => readScalar(dv, base + offs[k], s.fields[k].type, little);
  const b = new PointBuilder(hasColor, ii >= 0, n);
  for (let p = 0; p < n; p++) {
    const base = p * rec;
    b.push(rd(base, ix), rd(base, iy), rd(base, iz), ii >= 0 ? rd(base, ii) : 0,
      hasColor ? rd(base, ir) : 0, hasColor ? rd(base, ig) : 0, hasColor ? rd(base, ib) : 0);
  }
  return b.finish("Z", { source: "bin" });
}
