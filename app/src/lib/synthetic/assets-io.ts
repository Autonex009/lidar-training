import fs from "node:fs";
import path from "node:path";
import { writeFrames } from "../pointcloud/cache-node";
import { frameFileName } from "../pointcloud/cache";
import { DEMO_SCENE_KEYS, buildDemoScene } from "./scenes";
import type { ReferenceAnnotation } from "./types";

export const assetsRoot = () => path.join(process.cwd(), "data", "assets");

const b64 = (a: Uint16Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
export function unb64(s: string): Uint16Array {
  const buf = Buffer.from(s, "base64");
  return new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

/** JSON-safe reference: Uint16 point labels become base64 strings. */
export function serializeReference(ref: ReferenceAnnotation) {
  return {
    cuboids: ref.cuboids,
    frames: ref.frames,
    pointLabels: ref.pointLabels && {
      semanticB64: b64(ref.pointLabels.semantic), instanceB64: b64(ref.pointLabels.instance), classMap: ref.pointLabels.classMap,
    },
  };
}

export interface DemoAssetMeta {
  key: string;
  name: string;
  description: string;
  pointCount: number;
  frameCount: number;
  upAxis: "Z";
  initialAnnotation?: unknown;
  plantedErrors?: unknown;
}

export function demoAssetDir(key: string, root = assetsRoot()) {
  return path.join(root, key);
}

export function demoAssetComplete(key: string, root = assetsRoot()): boolean {
  const dir = demoAssetDir(key, root);
  return ["meta.json", "reference.json", frameFileName(0)].every((f) => fs.existsSync(path.join(dir, f)));
}

/** Generates (deterministically, so rewriting is idempotent) one demo scene to <root>/<key>/. */
export function writeDemoAsset(key: string, root = assetsRoot()): DemoAssetMeta {
  const s = buildDemoScene(key);
  const dir = demoAssetDir(key, root);
  fs.mkdirSync(dir, { recursive: true });
  writeFrames(dir, s.frames);
  fs.writeFileSync(path.join(dir, "reference.json"), JSON.stringify(serializeReference(s.reference)));
  const meta: DemoAssetMeta = {
    key, name: s.name, description: s.description, pointCount: s.cloud.pointCount, frameCount: s.frames.length, upAxis: "Z",
    initialAnnotation: s.initialAnnotation, plantedErrors: s.plantedErrors,
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  return meta;
}

export function ensureDemoAssets(opts: { force?: boolean; root?: string } = {}): DemoAssetMeta[] {
  const root = opts.root ?? assetsRoot();
  return DEMO_SCENE_KEYS.map((key) => {
    if (!opts.force && demoAssetComplete(key, root)) return JSON.parse(fs.readFileSync(path.join(demoAssetDir(key, root), "meta.json"), "utf8")) as DemoAssetMeta;
    return writeDemoAsset(key, root);
  });
}
