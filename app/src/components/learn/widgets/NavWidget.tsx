"use client";

import { useMemo } from "react";
import { PointCloudViewer, assetFrameSource, type ControlKind } from "@/components/viewer";
import { usePageTours } from "@/components/tour/PageTours";
import { useTourOptional } from "@/components/tour/TourProvider";
import { Button } from "@/components/ui/Button";
import { Checklist } from "./Parts";
import type { AssetRef, WidgetProps } from "./types";

/** Checkpoint key -> viewer control (and preset detail). Used when the user just tries controls without the tutorial. */
const CONTROL: Record<string, { kind: ControlKind; detail?: string }> = {
  rotate: { kind: "rotate" }, pan: { kind: "pan" }, zoom: { kind: "zoom" }, reset: { kind: "reset" },
  top: { kind: "preset", detail: "top" }, front: { kind: "preset", detail: "front" }, side: { kind: "preset", detail: "side" },
};
/** Checkpoints the guided navigation tour covers; they tick when the tour completes. */
const TOUR_COVERS = new Set(["rotate", "pan", "zoom", "reset"]);

/**
 * Practice viewer. The step-by-step dialog is the shared guided-tour engine (`navigation-3d`), which
 * starts automatically the first time and can be restarted with the button below. Direct control use still
 * ticks the lesson checkpoints, so the lesson works with or without the tutorial.
 */
export function NavWidget({ checkpoints, done, onDone, instructions, asset }: WidgetProps & { asset: AssetRef | null }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const tour = useTourOptional();
  const hasFrames = (asset?.frameCount ?? 1) > 1;
  const finish = () => { for (const c of checkpoints) if (TOUR_COVERS.has(c.key)) onDone(c.key); };
  usePageTours(["navigation-3d"], { hasFrames }, { "navigation-3d": finish });

  const used = (kind: ControlKind, detail?: string) => {
    for (const c of checkpoints) {
      const h = CONTROL[c.key];
      if (h && h.kind === kind && (!h.detail || h.detail === detail)) onDone(c.key);
    }
  };

  return (
    <div>
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="relative h-[460px]">
        {frames ? <PointCloudViewer frames={frames} onControlUsed={used} title="Practice scene" /> : <p className="text-[13px] text-muted">Demo scene not available.</p>}
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <Checklist checkpoints={checkpoints} done={done} />
        {tour && frames ? <Button data-testid="start-nav-tour" onClick={() => tour.startTour("navigation-3d", { force: true, context: { hasFrames }, onComplete: finish })}>Start navigation tutorial</Button> : null}
      </div>
    </div>
  );
}
