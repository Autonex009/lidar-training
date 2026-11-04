import { PointCloudParseError, type NormalizedCloud } from "../types";
import { PointBuilder, asciiSlice, dataView } from "./common";

const MIN_LEN: Record<number, number> = { 0: 20, 1: 28, 2: 26, 3: 34, 6: 30, 7: 36, 8: 38 };
const RGB_OFF: Record<number, number> = { 2: 20, 3: 28, 7: 30, 8: 30 };
const LAZ_MSG = "LAZ not supported, decompress to LAS first";

export function parseLas(u8: Uint8Array): NormalizedCloud {
  if (u8.length < 227 || asciiSlice(u8, 0, 4) !== "LASF") throw new PointCloudParseError("LAS: bad signature");
  const dv = dataView(u8);
  const major = u8[24], minor = u8[25];
  if (major !== 1 || minor < 2 || minor > 4) throw new PointCloudParseError(`LAS: unsupported version ${major}.${minor}`);
  const headerSize = dv.getUint16(94, true);
  const dataOffset = dv.getUint32(96, true);
  const nVlr = dv.getUint32(100, true);
  const rawFmt = u8[104];
  const recLen = dv.getUint16(105, true);
  if (rawFmt & 0x80) throw new PointCloudParseError(LAZ_MSG);
  const fmt = rawFmt & 0x3f;
  // laszip VLR check (compressed data with unmodified format id).
  let vp = headerSize;
  for (let i = 0; i < nVlr && vp + 54 <= u8.length; i++) {
    if (asciiSlice(u8, vp + 2, vp + 18).startsWith("laszip encoded")) throw new PointCloudParseError(LAZ_MSG);
    vp += 54 + dv.getUint16(vp + 20, true);
  }
  if (!(fmt in MIN_LEN)) throw new PointCloudParseError(`LAS: unsupported point format ${fmt} (supported: 0,1,2,3,6,7,8)`);
  if (recLen < MIN_LEN[fmt]) throw new PointCloudParseError("LAS: point record length too small for format");
  let count = dv.getUint32(107, true);
  if (minor === 4) {
    const big = dv.getBigUint64(247, true);
    if (big > BigInt(0)) count = Number(big);
  }
  if (dataOffset + count * recLen > u8.length) throw new PointCloudParseError("LAS: file truncated");
  const sx = dv.getFloat64(131, true), sy = dv.getFloat64(139, true), sz = dv.getFloat64(147, true);
  const ox = dv.getFloat64(155, true), oy = dv.getFloat64(163, true), oz = dv.getFloat64(171, true);
  const rgbOff = RGB_OFF[fmt];
  const b = new PointBuilder(rgbOff !== undefined, true, count);
  for (let n = 0; n < count; n++) {
    const p = dataOffset + n * recLen;
    const x = dv.getInt32(p, true) * sx + ox;
    const y = dv.getInt32(p + 4, true) * sy + oy;
    const z = dv.getInt32(p + 8, true) * sz + oz;
    const inten = dv.getUint16(p + 12, true);
    if (rgbOff !== undefined) {
      // 16-bit colour: treat as 8-bit if all channels fit in a byte, else scale down.
      const r = dv.getUint16(p + rgbOff, true), g = dv.getUint16(p + rgbOff + 2, true), bl = dv.getUint16(p + rgbOff + 4, true);
      b.push(x, y, z, inten, r > 255 ? r >> 8 : r, g > 255 ? g >> 8 : g, bl > 255 ? bl >> 8 : bl);
    } else b.push(x, y, z, inten);
  }
  return b.finish("Z", { source: "las", version: `${major}.${minor}`, pointFormat: fmt });
}
