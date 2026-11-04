import { z } from "zod";

export type Vec3 = [number, number, number];

export interface Cuboid {
  id: string;
  trackId?: number;
  label: string;
  /** Data frame (asset native, Z-up by default). */
  center: Vec3;
  /** [length (heading), width, height]. */
  dims: Vec3;
  yaw: number;
  attributes: Record<string, string>;
  note?: string;
}

export interface FrameAnnotations { cuboids: Cuboid[] }

export interface Flag {
  id: string;
  frame?: number;
  cuboidId?: string;
  reason: string;
  position?: Vec3;
}

export interface ErrorFound { id: string; tag: string; targetAnnotationId?: string; explanation: string; frame?: number; position?: Vec3 }

export interface PointLabelFrame {
  frame: number;
  /** base64 Uint16Array, one entry per point. */
  semantic?: string;
  instance?: string;
}

export interface AnnotationDocument {
  version: 1;
  frames: Record<number, FrameAnnotations>;
  flags: Flag[];
  answers: Record<string, string | number>;
  checkpoints: Record<string, true>;
  errorsFound?: ErrorFound[];
  pointLabels?: PointLabelFrame[];
}

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

export const cuboidSchema = z.object({
  id: z.string().min(1).max(80),
  trackId: z.number().int().min(0).max(1_000_000).optional(),
  label: z.string().max(80),
  center: vec3,
  dims: vec3,
  yaw: z.number().finite(),
  attributes: z.record(z.string(), z.string().max(200)),
  note: z.string().max(2000).optional(),
});

export const annotationDocumentSchema = z.object({
  version: z.literal(1),
  frames: z.record(z.string().regex(/^\d+$/), z.object({ cuboids: z.array(cuboidSchema).max(2000) })),
  flags: z.array(z.object({
    id: z.string().min(1).max(80), frame: z.number().int().min(0).optional(), cuboidId: z.string().max(80).optional(),
    reason: z.string().max(2000), position: vec3.optional(),
  })).max(1000),
  answers: z.record(z.string(), z.union([z.string().max(10000), z.number()])),
  checkpoints: z.record(z.string(), z.literal(true)),
  errorsFound: z.array(z.object({
    id: z.string().min(1).max(80), tag: z.string().max(80), targetAnnotationId: z.string().max(80).optional(),
    explanation: z.string().max(2000), frame: z.number().int().min(0).optional(), position: vec3.optional(),
  })).max(500).optional(),
  pointLabels: z.array(z.object({
    frame: z.number().int().min(0), semantic: z.string().max(8_000_000).optional(), instance: z.string().max(8_000_000).optional(),
  })).max(64).optional(),
});

export function emptyDocument(): AnnotationDocument {
  return { version: 1, frames: {}, flags: [], answers: {}, checkpoints: {} };
}

/** Normalise parsed JSON into a document (frames keys are strings in JSON). */
export function parseDocument(raw: unknown): AnnotationDocument | null {
  const r = annotationDocumentSchema.safeParse(raw);
  if (!r.success) return null;
  return r.data as unknown as AnnotationDocument;
}

export function cuboidsOf(doc: AnnotationDocument, frame: number): Cuboid[] {
  return doc.frames[frame]?.cuboids ?? [];
}

export function allCuboids(doc: AnnotationDocument): { frame: number; cuboid: Cuboid }[] {
  const out: { frame: number; cuboid: Cuboid }[] = [];
  for (const [f, fa] of Object.entries(doc.frames)) for (const c of fa.cuboids) out.push({ frame: Number(f), cuboid: c });
  return out;
}

export function b64ToU16(s: string): Uint16Array {
  const bin = typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("binary");
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Uint16Array(buf.buffer, 0, Math.floor(buf.byteLength / 2));
}

export function u16ToB64(a: Uint16Array): string {
  const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  if (typeof btoa === "function") {
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  return Buffer.from(u8).toString("base64");
}

/** Reference/initial cuboid (neutral format) -> document cuboid. */
export function toDocCuboid(c: { id: string; trackId?: number; label: string; center: Vec3; dims: Vec3; yaw: number; attributes?: Record<string, unknown> }): Cuboid {
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.attributes ?? {})) if (typeof v === "string") attrs[k] = v;
  return { id: c.id, trackId: c.trackId, label: c.label, center: [...c.center], dims: [...c.dims], yaw: c.yaw, attributes: attrs };
}
