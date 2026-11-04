import { PointCloudParseError, type NormalizedCloud, type ScalarType } from "../types";
import { PointBuilder, SCALAR_SIZE, asciiSlice, dataView, readScalar } from "./common";

const PLY_TYPES: Record<string, ScalarType> = {
  char: "int8", uchar: "uint8", short: "int16", ushort: "uint16", int: "int32", uint: "uint32", float: "float32", double: "float64",
  int8: "int8", uint8: "uint8", int16: "int16", uint16: "uint16", int32: "int32", uint32: "uint32", float32: "float32", float64: "float64",
};

interface Prop { name: string; type: ScalarType; isList: boolean }
interface Element { name: string; count: number; props: Prop[] }

export function parsePly(u8: Uint8Array): NormalizedCloud {
  const marker = "end_header";
  let hdrEnd = -1;
  const searchLimit = Math.min(u8.length, 1 << 20);
  for (let i = 0; i < searchLimit - marker.length; i++) {
    let ok = true;
    for (let k = 0; k < marker.length; k++) if (u8[i + k] !== marker.charCodeAt(k)) { ok = false; break; }
    if (ok) { hdrEnd = i; break; }
  }
  if (hdrEnd < 0) throw new PointCloudParseError("PLY: missing end_header");
  let dataStart = hdrEnd + marker.length;
  if (u8[dataStart] === 13) dataStart++;
  if (u8[dataStart] === 10) dataStart++;

  const lines = asciiSlice(u8, 0, hdrEnd).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines[0] !== "ply") throw new PointCloudParseError("PLY: bad magic");
  let format = "";
  const elements: Element[] = [];
  for (const line of lines.slice(1)) {
    const t = line.split(/\s+/);
    if (t[0] === "format") format = t[1];
    else if (t[0] === "element") elements.push({ name: t[1], count: Number(t[2]), props: [] });
    else if (t[0] === "property") {
      const el = elements[elements.length - 1];
      if (!el) throw new PointCloudParseError("PLY: property before element");
      if (t[1] === "list") el.props.push({ name: t[4], type: PLY_TYPES[t[3]] ?? "int32", isList: true });
      else {
        const type = PLY_TYPES[t[1]];
        if (!type) throw new PointCloudParseError(`PLY: unknown property type "${t[1]}"`);
        el.props.push({ name: t[2], type, isList: false });
      }
    }
  }
  if (!["ascii", "binary_little_endian", "binary_big_endian"].includes(format)) {
    throw new PointCloudParseError(`PLY: unsupported format "${format}"`);
  }
  const vIdx = elements.findIndex((e) => e.name === "vertex");
  if (vIdx < 0) throw new PointCloudParseError("PLY: no vertex element");
  const vertex = elements[vIdx];
  if (vertex.props.some((p) => p.isList)) throw new PointCloudParseError("PLY: list properties in vertex element not supported");
  const names = vertex.props.map((p) => p.name);
  for (const a of ["x", "y", "z"]) if (!names.includes(a)) throw new PointCloudParseError(`PLY: vertex is missing required property "${a}"`);

  const col = (alts: string[]) => vertex.props.findIndex((p) => alts.includes(p.name));
  const ix = col(["x"]), iy = col(["y"]), iz = col(["z"]);
  const ir = col(["red", "r"]), ig = col(["green", "g"]), ib = col(["blue", "b"]);
  const ii = col(["intensity", "scalar_intensity", "i"]);
  const hasColor = ir >= 0 && ig >= 0 && ib >= 0;
  const colorScale = hasColor && vertex.props[ir].type.startsWith("float") ? 255 : 1;
  const b = new PointBuilder(hasColor, ii >= 0, vertex.count);

  if (format === "ascii") {
    const text = asciiSlice(u8, dataStart, u8.length);
    const rows = text.split(/\r?\n/);
    let row = 0;
    for (let e = 0; e < vIdx; e++) row += elements[e].count;
    for (let n = 0; n < vertex.count; n++) {
      const line = rows[row + n];
      if (line === undefined) throw new PointCloudParseError("PLY: unexpected end of ascii data");
      const t = line.trim().split(/\s+/).map(Number);
      b.push(t[ix], t[iy], t[iz], ii >= 0 ? t[ii] : 0,
        hasColor ? t[ir] * colorScale : 0, hasColor ? t[ig] * colorScale : 0, hasColor ? t[ib] * colorScale : 0);
    }
  } else {
    const little = format === "binary_little_endian";
    let off = dataStart;
    for (let e = 0; e < vIdx; e++) {
      const el = elements[e];
      if (el.props.some((p) => p.isList)) throw new PointCloudParseError("PLY: list elements before 'vertex' are not supported");
      off += el.count * el.props.reduce((s, p) => s + SCALAR_SIZE[p.type], 0);
    }
    const offsets: number[] = [];
    let rec = 0;
    for (const p of vertex.props) { offsets.push(rec); rec += SCALAR_SIZE[p.type]; }
    if (off + rec * vertex.count > u8.length) throw new PointCloudParseError("PLY: file truncated");
    const dv = dataView(u8);
    const rd = (base: number, k: number) => readScalar(dv, base + offsets[k], vertex.props[k].type, little);
    for (let n = 0; n < vertex.count; n++) {
      const base = off + n * rec;
      b.push(rd(base, ix), rd(base, iy), rd(base, iz), ii >= 0 ? rd(base, ii) : 0,
        hasColor ? rd(base, ir) * colorScale : 0, hasColor ? rd(base, ig) * colorScale : 0, hasColor ? rd(base, ib) * colorScale : 0);
    }
  }
  return b.finish("Z", { source: "ply", format });
}
