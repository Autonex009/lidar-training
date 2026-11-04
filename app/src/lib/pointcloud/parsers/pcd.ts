import { PointCloudParseError, type NormalizedCloud, type ScalarType } from "../types";
import { PointBuilder, asciiSlice, dataView, readScalar } from "./common";

function pcdType(t: string, size: number): ScalarType {
  const key = `${t}${size}`;
  const m: Record<string, ScalarType> = {
    F4: "float32", F8: "float64", U1: "uint8", U2: "uint16", U4: "uint32", I1: "int8", I2: "int16", I4: "int32",
  };
  const r = m[key];
  if (!r) throw new PointCloudParseError(`PCD: unsupported field type ${t}${size}`);
  return r;
}

export function parsePcd(u8: Uint8Array): NormalizedCloud {
  // Header ends after the "DATA ..." line.
  let pos = 0;
  const hdr: Record<string, string[]> = {};
  let dataKind = "";
  while (pos < u8.length) {
    let e = pos;
    while (e < u8.length && u8[e] !== 10) e++;
    const line = asciiSlice(u8, pos, e).trim();
    pos = e + 1;
    if (!line || line.startsWith("#")) continue;
    const t = line.split(/\s+/);
    hdr[t[0].toUpperCase()] = t.slice(1);
    if (t[0].toUpperCase() === "DATA") { dataKind = (t[1] ?? "").toLowerCase(); break; }
    if (pos > 65536) throw new PointCloudParseError("PCD: header too long / missing DATA line");
  }
  if (!dataKind) throw new PointCloudParseError("PCD: missing DATA line");
  if (dataKind === "binary_compressed") throw new PointCloudParseError("PCD binary_compressed not supported");
  if (dataKind !== "ascii" && dataKind !== "binary") throw new PointCloudParseError(`PCD: unknown DATA type "${dataKind}"`);

  const fields = hdr.FIELDS;
  if (!fields) throw new PointCloudParseError("PCD: missing FIELDS");
  const sizes = (hdr.SIZE ?? []).map(Number);
  const types = hdr.TYPE ?? [];
  const counts = hdr.COUNT ? hdr.COUNT.map(Number) : fields.map(() => 1);
  for (const a of ["x", "y", "z"]) if (!fields.includes(a)) throw new PointCloudParseError(`PCD: missing required field "${a}"`);
  const total = Number(hdr.POINTS?.[0] ?? Number(hdr.WIDTH?.[0] ?? 0) * Number(hdr.HEIGHT?.[0] ?? 1));

  const stypes = fields.map((_, i) => pcdType(types[i], sizes[i]));
  const byteOff: number[] = [];
  const tokOff: number[] = [];
  let rec = 0, tok = 0;
  fields.forEach((_, i) => { byteOff.push(rec); tokOff.push(tok); rec += sizes[i] * counts[i]; tok += counts[i]; });

  const fi = (n: string) => fields.indexOf(n);
  const ix = fi("x"), iy = fi("y"), iz = fi("z"), ii = fi("intensity");
  const irgb = fi("rgb") >= 0 ? fi("rgb") : fi("rgba");
  const ir = fi("r"), ig = fi("g"), ib = fi("b");
  const hasColor = irgb >= 0 || (ir >= 0 && ig >= 0 && ib >= 0);
  const b = new PointBuilder(hasColor, ii >= 0, total);
  const packed = (bits: number) => [(bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255];

  if (dataKind === "ascii") {
    const rows = asciiSlice(u8, pos, u8.length).split(/\r?\n/);
    for (let n = 0; n < total; n++) {
      if (rows[n] === undefined) throw new PointCloudParseError("PCD: unexpected end of ascii data");
      const t = rows[n].trim().split(/\s+/).map(Number);
      let r = 0, g = 0, bl = 0;
      if (irgb >= 0) {
        const v = t[tokOff[irgb]];
        let bits = v;
        if (stypes[irgb] === "float32") { const f = new Float32Array([v]); bits = new Uint32Array(f.buffer)[0]; }
        [r, g, bl] = packed(bits);
      } else if (hasColor) { r = t[tokOff[ir]]; g = t[tokOff[ig]]; bl = t[tokOff[ib]]; }
      b.push(t[tokOff[ix]], t[tokOff[iy]], t[tokOff[iz]], ii >= 0 ? t[tokOff[ii]] : 0, r, g, bl);
    }
  } else {
    if (pos + rec * total > u8.length) throw new PointCloudParseError("PCD: file truncated");
    const dv = dataView(u8);
    const rd = (base: number, k: number) => readScalar(dv, base + byteOff[k], stypes[k], true);
    for (let n = 0; n < total; n++) {
      const base = pos + n * rec;
      let r = 0, g = 0, bl = 0;
      if (irgb >= 0) {
        const bits = dv.getUint32(base + byteOff[irgb], true);
        [r, g, bl] = packed(bits);
      } else if (hasColor) { r = rd(base, ir); g = rd(base, ig); bl = rd(base, ib); }
      b.push(rd(base, ix), rd(base, iy), rd(base, iz), ii >= 0 ? rd(base, ii) : 0, r, g, bl);
    }
  }
  return b.finish("Z", { source: "pcd", data: dataKind });
}
