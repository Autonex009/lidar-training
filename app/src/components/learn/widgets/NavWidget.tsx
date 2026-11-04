"use client";

import { useMemo, useState } from "react";
import { PointCloudViewer, assetFrameSource, type ControlKind } from "@/components/viewer";
import { Keycap, StepDialog } from "./Parts";
import type { AssetRef, WidgetProps } from "./types";

const HINTS: Record<string, { kind: ControlKind; detail?: string; keys: string[]; text: string }> = {
  rotate: { kind: "rotate", keys: ["Left-drag"], text: "Drag with the left mouse button to rotate around the scene." },
  pan: { kind: "pan", keys: ["Right-drag", "or Shift+drag"], text: "Drag with the right mouse button to slide the view sideways." },
  zoom: { kind: "zoom", keys: ["Scroll"], text: "Scroll the mouse wheel (or pinch) to zoom in and out." },
  reset: { kind: "reset", keys: ["Reset"], text: "Press Reset in the viewer toolbar to return to the starting view." },
  top: { kind: "preset", detail: "top", keys: ["Top"], text: "Press Top in the toolbar to look straight down." },
  front: { kind: "preset", detail: "front", keys: ["Front"], text: "Press Front in the toolbar to look from the front." },
  side: { kind: "preset", detail: "side", keys: ["Side"], text: "Press Side in the toolbar to look from the side." },
};

/** Viewer with a bottom-centred step dialog; one step per checkpoint, detected via onControlUsed. */
export function NavWidget({ checkpoints, done, onDone, instructions, asset }: WidgetProps & { asset: AssetRef | null }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const [step, setStep] = useState(0);
  const cur = checkpoints[Math.min(step, checkpoints.length - 1)];
  const hint = HINTS[cur.key];

  const used = (kind: ControlKind, detail?: string) => {
    for (const c of checkpoints) {
      const h = HINTS[c.key];
      if (h && h.kind === kind && (!h.detail || h.detail === detail)) onDone(c.key);
    }
  };

  return (
    <div>
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="relative h-[460px]">
        {frames ? <PointCloudViewer frames={frames} onControlUsed={used} title="Practice scene" /> : <p className="text-[13px] text-muted">Demo scene not available.</p>}
        <div className="pointer-events-none absolute inset-0">
          <StepDialog
            title={cur.label}
            text={hint?.text ?? "Try this control in the viewer."}
            keys={hint?.keys.map((k) => <Keycap key={k}>{k}</Keycap>)}
            complete={done.has(cur.key)}
            step={step}
            count={checkpoints.length}
            onStep={setStep}
          />
        </div>
      </div>
    </div>
  );
}
