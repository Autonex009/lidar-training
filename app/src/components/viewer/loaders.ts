import { parseCache } from "@/lib/pointcloud/cache";
import type { FrameSource } from "./types";

/** Frame source that streams normalized cache files from /api/assets/:id/frames/:n. */
export function assetFrameSource(assetId: string, frameCount: number, opts: { withLabels?: boolean } = {}): FrameSource {
  return {
    frameCount,
    async load(index) {
      const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/frames/${index}${opts.withLabels ? "?withLabels=1" : ""}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Failed to load frame ${index} (${res.status})`);
      return parseCache(await res.arrayBuffer());
    },
  };
}
