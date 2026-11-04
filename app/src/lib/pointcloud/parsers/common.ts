import { PointCloudParseError, type Bounds, type NormalizedCloud, type ScalarType, type UpAxis } from "../types";

export const SCALAR_SIZE: Record<ScalarType, number> = {
  int8: 1, uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4, float32: 4, float64: 8,
};

export function readScalar(dv: DataView, off: number, type: ScalarType, little: boolean): number {
  switch (type) {
    case "int8": return dv.getInt8(off);
    case "uint8": return dv.getUint8(off);
    case "int16": return dv.getInt16(off, little);
    case "uint16": return dv.getUint16(off, little);
    case "int32": return dv.getInt32(off, little);
    case "uint32": return dv.getUint32(off, little);
    case "float32": return dv.getFloat32(off, little);
    case "float64": return dv.getFloat64(off, little);
  }
}

export function computeBounds(positions: Float32Array, count: number): Bounds {
  if (count === 0) return { min: [0, 0, 0], max: [0, 0, 0] };
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { min: [x0, y0, z0], max: [x1, y1, z1] };
}

/** Growable accumulator used by all parsers. Non-finite points are dropped. */
export class PointBuilder {
  count = 0;
  private cap: number;
  private positions: Float32Array;
  private colors?: Uint8Array;
  private intensity?: Float32Array;

  constructor(private wantColors: boolean, private wantIntensity: boolean, capacity = 1024) {
    this.cap = Math.max(16, capacity);
    this.positions = new Float32Array(this.cap * 3);
    if (wantColors) this.colors = new Uint8Array(this.cap * 3);
    if (wantIntensity) this.intensity = new Float32Array(this.cap);
  }

  private grow() {
    this.cap *= 2;
    const p = new Float32Array(this.cap * 3); p.set(this.positions); this.positions = p;
    if (this.colors) { const c = new Uint8Array(this.cap * 3); c.set(this.colors); this.colors = c; }
    if (this.intensity) { const n = new Float32Array(this.cap); n.set(this.intensity); this.intensity = n; }
  }

  push(x: number, y: number, z: number, i = 0, r = 0, g = 0, b = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    if (this.count >= this.cap) this.grow();
    const n = this.count++;
    this.positions[n * 3] = x; this.positions[n * 3 + 1] = y; this.positions[n * 3 + 2] = z;
    if (this.colors) {
      this.colors[n * 3] = clamp8(r); this.colors[n * 3 + 1] = clamp8(g); this.colors[n * 3 + 2] = clamp8(b);
    }
    if (this.intensity) this.intensity[n] = Number.isFinite(i) ? i : 0;
  }

  finish(upAxis: UpAxis = "Z", metadata: Record<string, unknown> = {}): NormalizedCloud {
    const n = this.count;
    if (n === 0) throw new PointCloudParseError("File contains no valid points");
    const positions = this.positions.slice(0, n * 3);
    return {
      pointCount: n,
      positions,
      colors: this.colors?.slice(0, n * 3),
      intensity: this.intensity?.slice(0, n),
      upAxis,
      bounds: computeBounds(positions, n),
      metadata,
    };
  }
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export function asUint8(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

export function dataView(u8: Uint8Array): DataView {
  return new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
}

export function asciiSlice(u8: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end; i += 8192) s += String.fromCharCode(...u8.subarray(i, Math.min(end, i + 8192)));
  return s;
}
