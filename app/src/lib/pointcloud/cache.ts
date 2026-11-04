import { PointCloudParseError, type Bounds, type NormalizedCloud, type UpAxis } from "./types";

/** Binary cache: "LPC1" | u32 headerLen | JSON header (space padded to 4) | f32 xyz | f32 intensity? | u16 semantic? | u16 instance? | u8 rgb? */
const MAGIC = [0x4c, 0x50, 0x43, 0x31];

interface CacheHeader {
  version: 1;
  pointCount: number;
  hasColors: boolean;
  hasIntensity: boolean;
  hasLabels: boolean;
  upAxis: UpAxis;
  bounds: Bounds;
  frameIndex?: number;
  metadata: Record<string, unknown>;
}

export function encodeCache(cloud: NormalizedCloud): Uint8Array {
  const header: CacheHeader = {
    version: 1,
    pointCount: cloud.pointCount,
    hasColors: !!cloud.colors,
    hasIntensity: !!cloud.intensity,
    hasLabels: !!cloud.labels,
    upAxis: cloud.upAxis,
    bounds: cloud.bounds,
    frameIndex: cloud.frameIndex,
    metadata: cloud.metadata,
  };
  let json = JSON.stringify(header);
  while ((json.length & 3) !== 0) json += " ";
  const hb = new TextEncoder().encode(json);
  const n = cloud.pointCount;
  const size = 8 + hb.length + n * 12 + (cloud.intensity ? n * 4 : 0) + (cloud.labels ? n * 4 : 0) + (cloud.colors ? n * 3 : 0);
  const out = new Uint8Array(size);
  out.set(MAGIC, 0);
  const dv = new DataView(out.buffer);
  dv.setUint32(4, hb.length, true);
  out.set(hb, 8);
  let off = 8 + hb.length;
  const put = (arr: ArrayBufferView) => {
    out.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), off);
    off += arr.byteLength;
  };
  put(cloud.positions.subarray(0, n * 3));
  if (cloud.intensity) put(cloud.intensity.subarray(0, n));
  if (cloud.labels) { put(cloud.labels.semantic.subarray(0, n)); put(cloud.labels.instance.subarray(0, n)); }
  if (cloud.colors) put(cloud.colors.subarray(0, n * 3));
  return out;
}

/** Works in browser and Node. */
export function parseCache(buffer: ArrayBuffer | Uint8Array): NormalizedCloud {
  // Node Buffers override slice() with a non-copying view; always view as a plain Uint8Array.
  const u8 = buffer instanceof Uint8Array ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) : new Uint8Array(buffer);
  if (u8.length < 8 || MAGIC.some((m, i) => u8[i] !== m)) throw new PointCloudParseError("Not a point-cloud cache file (bad magic)");
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const hl = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl))) as CacheHeader;
  const n = header.pointCount;
  let off = 8 + hl;
  // Copy into fresh aligned buffers so views are always valid regardless of source byteOffset.
  const f32 = (count: number) => { const a = new Float32Array(count); a.set(new Float32Array(u8.slice(off, off + count * 4).buffer)); off += count * 4; return a; };
  const u16 = (count: number) => { const a = new Uint16Array(count); a.set(new Uint16Array(u8.slice(off, off + count * 2).buffer)); off += count * 2; return a; };
  const positions = f32(n * 3);
  const intensity = header.hasIntensity ? f32(n) : undefined;
  const labels = header.hasLabels ? { semantic: u16(n), instance: u16(n) } : undefined;
  const colors = header.hasColors ? u8.slice(off, off + n * 3) : undefined;
  return {
    pointCount: n, positions, intensity, labels, colors,
    upAxis: header.upAxis, bounds: header.bounds, frameIndex: header.frameIndex, metadata: header.metadata,
  };
}

export const frameFileName = (i: number) => `frame_${String(i).padStart(3, "0")}.bin`;

export const frameNoLabelsFileName = (i: number) => frameFileName(i).replace(/\.bin$/, ".nolabels.bin");

/** Re-encodes a cache buffer without per-point semantic/instance labels (hasLabels=false). */
export function stripLabelsFromCache(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  const cloud = parseCache(buffer);
  return encodeCache({ ...cloud, labels: undefined });
}
