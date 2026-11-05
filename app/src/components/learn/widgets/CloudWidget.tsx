"use client";

import { useEffect, useMemo, useRef } from "react";
import { PointCloudViewer, assetFrameSource, type ControlKind } from "@/components/viewer";
import { usePageTours } from "@/components/tour/PageTours";
import type { AssetRef, WidgetProps } from "./types";

const KIND_KEYS = new Set(["rotate", "pan", "zoom"]);

/** Free exploration of a demo cloud. Checkpoints named after a control tick on use; others ("explored") after any control + 10s. */
export function CloudWidget({ checkpoints, done, onDone, instructions, asset }: WidgetProps & { asset: AssetRef | null }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const firstUse = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  usePageTours(["navigation-3d"], { hasFrames: (asset?.frameCount ?? 1) > 1 });
  const doneRef = useRef(done);
  doneRef.current = done;
  const cpRef = useRef(checkpoints);
  cpRef.current = checkpoints;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const used = (kind: ControlKind) => {
    for (const c of cpRef.current) if (c.key === kind && KIND_KEYS.has(kind)) onDone(c.key);
    if (firstUse.current === null) {
      firstUse.current = Date.now();
      timer.current = setTimeout(() => {
        for (const c of cpRef.current) if (!KIND_KEYS.has(c.key)) onDone(c.key);
      }, 10_000);
    }
  };

  return (
    <div>
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="h-[380px]">{frames ? <PointCloudViewer frames={frames} onControlUsed={used} title="Sample cloud" /> : <p className="text-[13px] text-muted">Demo scene not available.</p>}</div>
    </div>
  );
}
