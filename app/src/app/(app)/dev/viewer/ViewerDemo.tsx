"use client";

import { useMemo, useRef, useState } from "react";
import { PointCloudViewer, assetFrameSource, type CuboidOverlay, type ViewerApi } from "@/components/viewer";

export function ViewerDemo({ assetId, frameCount, cuboids }: { assetId: string; frameCount: number; cuboids: CuboidOverlay[] }) {
  const api = useRef<ViewerApi>(null);
  const frames = useMemo(() => assetFrameSource(assetId, frameCount), [assetId, frameCount]);
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex h-[calc(100vh-140px)] flex-col gap-2">
      <div className="text-[12px] text-muted">
        Selected: <span className="text-ink">{selected ?? "none"}</span> · Last controls: {log.slice(-6).join(", ") || "none"}
      </div>
      <div className="min-h-0 flex-1">
        <PointCloudViewer
          ref={api} frames={frames} overlays={cuboids} selectedId={selected} onSelect={setSelected}
          onControlUsed={(k, d) => setLog((l) => [...l, d ? `${k}:${d}` : k])}
          title="demo-cuboid-basic"
        />
      </div>
    </div>
  );
}
