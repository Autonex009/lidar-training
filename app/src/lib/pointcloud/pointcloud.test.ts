import { describe, expect, it } from "vitest";
import { parsePointCloud, subsample, KITTI_XYZI, type NormalizedCloud } from "./index";
import { encodeCache, parseCache } from "./cache";

const enc = (s: string) => new TextEncoder().encode(s);
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

describe("ply", () => {
  const hdr = (fmt: string) => `ply\nformat ${fmt} 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nproperty float intensity\nend_header\n`;
  it("ascii", () => {
    const c = parsePointCloud(enc(hdr("ascii") + "1 2 3 255 0 10 0.5\n4 5 6 1 2 3 0.25\n"), { format: "ply" });
    expect(c.pointCount).toBe(2);
    expect(Array.from(c.positions)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(c.colors!)).toEqual([255, 0, 10, 1, 2, 3]);
    expect(Array.from(c.intensity!)).toEqual([0.5, 0.25]);
    expect(c.bounds.max).toEqual([4, 5, 6]);
  });
  for (const little of [true, false]) {
    it(`binary ${little ? "little" : "big"} endian`, () => {
      const rec = 19;
      const buf = new DataView(new ArrayBuffer(rec * 2));
      [[1, 2, 3, 9, 8, 7, 0.5], [4, 5, 6, 1, 2, 3, 2]].forEach((r, i) => {
        const o = i * rec;
        buf.setFloat32(o, r[0], little); buf.setFloat32(o + 4, r[1], little); buf.setFloat32(o + 8, r[2], little);
        buf.setUint8(o + 12, r[3]); buf.setUint8(o + 13, r[4]); buf.setUint8(o + 14, r[5]);
        buf.setFloat32(o + 15, r[6], little);
      });
      const fmt = little ? "binary_little_endian" : "binary_big_endian";
      const c = parsePointCloud(cat(enc(hdr(fmt)), new Uint8Array(buf.buffer)), { format: "ply" });
      expect(Array.from(c.positions)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(Array.from(c.colors!)).toEqual([9, 8, 7, 1, 2, 3]);
      expect(Array.from(c.intensity!)).toEqual([0.5, 2]);
    });
  }
  it("requires x,y,z", () => {
    expect(() => parsePointCloud(enc("ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nend_header\n1 2\n"), { format: "ply" })).toThrow(/"z"/);
  });
});

describe("pcd", () => {
  const head = (data: string, extra = "") => `# .PCD v0.7\nVERSION 0.7\nFIELDS x y z intensity\nSIZE 4 4 4 4\nTYPE F F F F\nCOUNT 1 1 1 1\nWIDTH 2\nHEIGHT 1\nPOINTS 2\nDATA ${data}\n${extra}`;
  it("ascii", () => {
    const c = parsePointCloud(enc(head("ascii", "1 2 3 0.5\n4 5 6 0.7\n")), { format: "pcd" });
    expect(c.pointCount).toBe(2);
    expect(c.intensity![1]).toBeCloseTo(0.7);
  });
  it("binary", () => {
    const f = new Float32Array([1, 2, 3, 0.5, 4, 5, 6, 0.75]);
    const c = parsePointCloud(cat(enc(head("binary")), new Uint8Array(f.buffer)), { format: "pcd" });
    expect(Array.from(c.positions)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(c.intensity!)).toEqual([0.5, 0.75]);
  });
  it("binary rgb packed", () => {
    const h = "VERSION 0.7\nFIELDS x y z rgb\nSIZE 4 4 4 4\nTYPE F F F U\nCOUNT 1 1 1 1\nWIDTH 1\nHEIGHT 1\nPOINTS 1\nDATA binary\n";
    const b = new DataView(new ArrayBuffer(16));
    b.setFloat32(0, 1, true); b.setFloat32(4, 2, true); b.setFloat32(8, 3, true); b.setUint32(12, (10 << 16) | (20 << 8) | 30, true);
    const c = parsePointCloud(cat(enc(h), new Uint8Array(b.buffer)), { format: "pcd" });
    expect(Array.from(c.colors!)).toEqual([10, 20, 30]);
  });
  it("rejects binary_compressed", () => {
    expect(() => parsePointCloud(enc(head("binary_compressed")), { format: "pcd" })).toThrow("PCD binary_compressed not supported");
  });
});

describe("xyz/pts", () => {
  it("xyz with header and 3 columns", () => {
    const c = parsePointCloud(enc("# comment\nx y z\n1 2 3\n4 5 6\n"), { format: "xyz" });
    expect(c.pointCount).toBe(2);
    expect(c.intensity).toBeUndefined();
  });
  it("xyz i", () => {
    const c = parsePointCloud(enc("1 2 3 0.5\n4 5 6 0.6\n"), { format: "xyz" });
    expect(Array.from(c.intensity!).map((v) => +v.toFixed(2))).toEqual([0.5, 0.6]);
  });
  it("xyz rgb", () => {
    const c = parsePointCloud(enc("1 2 3 255 0 0\n"), { format: "xyz" });
    expect(Array.from(c.colors!)).toEqual([255, 0, 0]);
  });
  it("pts count line + i rgb", () => {
    const c = parsePointCloud(enc("2\n1 2 3 100 10 20 30\n4 5 6 200 40 50 60\n"), { format: "pts" });
    expect(c.pointCount).toBe(2);
    expect(Array.from(c.colors!)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(Array.from(c.intensity!)).toEqual([100, 200]);
  });
});

function makeLas(fmt: number, minor: number, pts: number[][]): Uint8Array {
  const recLen = { 0: 20, 1: 28, 2: 26, 3: 34, 6: 30, 7: 36, 8: 38 }[fmt]!;
  const headerSize = minor === 4 ? 375 : 227;
  const buf = new Uint8Array(headerSize + pts.length * recLen);
  const dv = new DataView(buf.buffer);
  buf.set(enc("LASF"), 0);
  buf[24] = 1; buf[25] = minor;
  dv.setUint16(94, headerSize, true);
  dv.setUint32(96, headerSize, true);
  buf[104] = fmt;
  dv.setUint16(105, recLen, true);
  dv.setUint32(107, pts.length, true);
  if (minor === 4) dv.setBigUint64(247, BigInt(pts.length), true);
  [0.01, 0.01, 0.01].forEach((s, i) => dv.setFloat64(131 + i * 8, s, true));
  [100, 200, 300].forEach((o, i) => dv.setFloat64(155 + i * 8, o, true));
  const rgbOff = { 2: 20, 3: 28, 7: 30, 8: 30 }[fmt as 2];
  pts.forEach((p, i) => {
    const o = headerSize + i * recLen;
    dv.setInt32(o, p[0], true); dv.setInt32(o + 4, p[1], true); dv.setInt32(o + 8, p[2], true);
    dv.setUint16(o + 12, p[3], true);
    if (rgbOff !== undefined) { dv.setUint16(o + rgbOff, p[4], true); dv.setUint16(o + rgbOff + 2, p[5], true); dv.setUint16(o + rgbOff + 4, p[6], true); }
  });
  return buf;
}

describe("las", () => {
  const pts = [[100, 200, 300, 50, 10, 20, 30], [-100, 0, 50, 60, 70, 80, 90]];
  for (const [fmt, minor] of [[0, 2], [1, 2], [2, 2], [3, 3], [6, 4], [7, 4], [8, 4]]) {
    it(`format ${fmt} v1.${minor}`, () => {
      const c = parsePointCloud(makeLas(fmt, minor, pts), { format: "las" });
      expect(c.pointCount).toBe(2);
      expect(c.positions[0]).toBeCloseTo(101); expect(c.positions[1]).toBeCloseTo(202); expect(c.positions[2]).toBeCloseTo(303);
      expect(c.positions[3]).toBeCloseTo(99);
      expect(c.intensity![0]).toBe(50);
      if ([2, 3, 7, 8].includes(fmt)) expect(Array.from(c.colors!.slice(0, 3))).toEqual([10, 20, 30]);
      else expect(c.colors).toBeUndefined();
    });
  }
  it("rejects LAZ", () => {
    const b = makeLas(0, 2, pts);
    b[104] |= 0x80;
    expect(() => parsePointCloud(b, { format: "las" })).toThrow("LAZ not supported, decompress to LAS first");
    expect(() => parsePointCloud(b, { format: "laz" })).toThrow("LAZ not supported");
  });
});

describe("bin", () => {
  it("refuses without schema", () => {
    expect(() => parsePointCloud(new Uint8Array(16), { format: "bin" })).toThrow(/recordSchema/);
  });
  it("KITTI_XYZI", () => {
    const f = new Float32Array([1, 2, 3, 0.5, 4, 5, 6, 0.9]);
    const c = parsePointCloud(new Uint8Array(f.buffer), { format: "bin", recordSchema: KITTI_XYZI });
    expect(c.pointCount).toBe(2);
    expect(c.intensity![1]).toBeCloseTo(0.9);
  });
  it("custom big endian schema", () => {
    const dv = new DataView(new ArrayBuffer(13));
    dv.setFloat32(0, 1, false); dv.setFloat32(4, 2, false); dv.setFloat32(8, 3, false); dv.setUint8(12, 77);
    const c = parsePointCloud(new Uint8Array(dv.buffer), {
      format: "bin",
      recordSchema: { byteOrder: "big", fields: [{ name: "x", type: "float32" }, { name: "y", type: "float32" }, { name: "z", type: "float32" }, { name: "intensity", type: "uint8" }] },
    });
    expect(Array.from(c.positions)).toEqual([1, 2, 3]);
    expect(c.intensity![0]).toBe(77);
  });
  it("rejects misaligned size", () => {
    expect(() => parsePointCloud(new Uint8Array(15), { format: "bin", recordSchema: KITTI_XYZI })).toThrow(/multiple/);
  });
});

function randomCloud(n: number): NormalizedCloud {
  const positions = new Float32Array(n * 3).map((_, i) => (i * 7919) % 1000 / 10);
  return {
    pointCount: n, positions,
    colors: new Uint8Array(n * 3).map((_, i) => i % 256),
    intensity: new Float32Array(n).map((_, i) => i / n),
    labels: { semantic: new Uint16Array(n).map((_, i) => i % 5), instance: new Uint16Array(n).map((_, i) => i % 3) },
    upAxis: "Z", bounds: { min: [0, 0, 0], max: [100, 100, 100] }, metadata: { a: 1 },
  };
}

describe("cache", () => {
  it("round trips", () => {
    const c = randomCloud(101);
    const bytes = encodeCache(c);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("LPC1");
    const r = parseCache(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(r.pointCount).toBe(101);
    expect(Array.from(r.positions)).toEqual(Array.from(c.positions));
    expect(Array.from(r.colors!)).toEqual(Array.from(c.colors!));
    expect(Array.from(r.intensity!)).toEqual(Array.from(c.intensity!));
    expect(Array.from(r.labels!.semantic)).toEqual(Array.from(c.labels!.semantic));
    expect(r.metadata).toEqual({ a: 1 });
    expect(r.upAxis).toBe("Z");
  });
  it("rejects bad magic", () => expect(() => parseCache(new Uint8Array(20))).toThrow(/magic/));
});

describe("subsample", () => {
  it("is deterministic and sized", () => {
    const c = randomCloud(1000);
    const a = subsample(c, 100, 42), b = subsample(c, 100, 42), d = subsample(c, 100, 43);
    expect(a.pointCount).toBe(100);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.positions)).not.toEqual(Array.from(d.positions));
    expect(a.colors!.length).toBe(300);
    expect(a.labels!.semantic.length).toBe(100);
  });
  it("returns input when under cap", () => {
    const c = randomCloud(10);
    expect(subsample(c, 100, 1)).toBe(c);
  });
});
