import fs from "node:fs";
import path from "node:path";
import { encodeCache, frameFileName, parseCache } from "./cache";
import type { NormalizedCloud } from "./types";

export function writeCacheFile(file: string, cloud: NormalizedCloud): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodeCache(cloud));
}

export function readCacheFile(file: string): NormalizedCloud {
  return parseCache(fs.readFileSync(file));
}

/** One cache file per frame: <dir>/frame_000.bin ... */
export function writeFrames(dir: string, frames: NormalizedCloud[]): string[] {
  return frames.map((f, i) => {
    const file = path.join(dir, frameFileName(i));
    writeCacheFile(file, { ...f, frameIndex: i });
    return file;
  });
}
