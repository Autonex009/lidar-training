"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import { VIEWER_COLORS } from "@/components/viewer/palette";
import { PointCloudViewer, assetFrameSource, type CuboidOverlay, type ViewerApi } from "@/components/viewer";
import { iou3d, type Box } from "@/lib/geometry/cuboid";
import type { AssetRef, WidgetProps } from "./types";

export interface ReferenceBox { center: [number, number, number]; dims: [number, number, number]; yaw: number; label: string }

const angleDiff = (a: number, b: number) => {
  const d = Math.abs(((a - b) % Math.PI) + Math.PI) % Math.PI;
  return Math.min(d, Math.PI - d);
};

function Slider({ label, value, min, max, step, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="flex items-center gap-2 text-[12px]">
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-[#7a9a00]" />
      <span className="w-14 shrink-0 text-right tabular-nums">{value.toFixed(2)}{unit}</span>
    </label>
  );
}

/** Not the annotation tool: one editable box driven by sliders, scored against one reference object. */
export function CuboidWidget({ onDone, instructions, asset, reference }: WidgetProps & { asset: AssetRef | null; reference: ReferenceBox | null }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const ref = reference;
  const groundZ = ref ? ref.center[2] - ref.dims[2] / 2 : 0;
  const init = useMemo(() => ({ x: (ref?.center[0] ?? 0) + 4, y: (ref?.center[1] ?? 0) - 3, l: 2.6, w: 1.4, h: 1.2, yawDeg: ((ref?.yaw ?? 0) * 180) / Math.PI + 55 }), [ref]);
  const [s, setS] = useState(init);
  const [showRef, setShowRef] = useState(false);
  const api = useRef<ViewerApi>(null);
  const focus = () => {
    const eng = api.current?.getEngine();
    if (!eng || !ref) return;
    eng.camera.position.copy(eng.root.localToWorld(new Vector3(...ref.center))).add(new Vector3(6, 7, 6));
    eng.setTarget(ref.center);
  };
  const set = (k: keyof typeof init) => (v: number) => setS((p) => ({ ...p, [k]: v }));

  const box: Box = { center: [s.x, s.y, groundZ + s.h / 2], dims: [s.l, s.w, s.h], yaw: (s.yawDeg * Math.PI) / 180 };
  const iou = ref ? iou3d(box, ref) : 0;
  const dist = ref ? Math.hypot(s.x - ref.center[0], s.y - ref.center[1]) : Infinity;
  const yawErr = ref ? angleDiff(box.yaw, ref.yaw) : Infinity;
  const resized = Math.abs(s.l - init.l) + Math.abs(s.w - init.w) + Math.abs(s.h - init.h) > 0.3;

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (!ref) return;
    if (dist < 1.5) onDoneRef.current("move");
    if (resized) onDoneRef.current("resize");
    if (yawErr < (15 * Math.PI) / 180) onDoneRef.current("rotate");
    if (iou >= 0.7) onDoneRef.current("fit");
  }, [ref, dist, resized, yawErr, iou]);

  const overlays = useMemo<CuboidOverlay[]>(() => {
    const o: CuboidOverlay[] = [{ id: "edit", label: "Your box", center: box.center, dims: box.dims, yaw: box.yaw, color: VIEWER_COLORS.edit }];
    if (showRef && ref) o.push({ id: "ref", label: "Reference", center: ref.center, dims: ref.dims, yaw: ref.yaw, color: VIEWER_COLORS.ref });
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, showRef, ref]);

  if (!ref || !frames) return <p className="text-[13px] text-muted">Demo scene not available.</p>;
  return (
    <div>
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-[420px]"><PointCloudViewer ref={api} frames={frames} overlays={overlays} onFrameChange={() => setTimeout(focus, 50)} title="Fit the blue box to the car" /></div>
        <div className="min-w-0 space-y-1.5 border border-line p-2">
          <div className="text-[12px] font-medium">Box controls</div>
          <Slider label="Center X" value={s.x} min={ref.center[0] - 8} max={ref.center[0] + 8} step={0.05} onChange={set("x")} />
          <Slider label="Center Y" value={s.y} min={ref.center[1] - 8} max={ref.center[1] + 8} step={0.05} onChange={set("y")} />
          <Slider label="Length" value={s.l} min={0.5} max={8} step={0.05} onChange={set("l")} />
          <Slider label="Width" value={s.w} min={0.5} max={5} step={0.05} onChange={set("w")} />
          <Slider label="Height" value={s.h} min={0.5} max={4} step={0.05} onChange={set("h")} />
          <Slider label="Yaw" value={s.yawDeg} min={-180} max={180} step={1} unit="°" onChange={set("yawDeg")} />
          <div className="flex items-center justify-between pt-1 text-[12px]">
            <span>3D IoU with reference: <b className={iou >= 0.7 ? "text-success" : ""}>{iou.toFixed(2)}</b> (need 0.70)</span>
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-muted"><input type="checkbox" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} />Show reference outline (hint)</label>
          <div className="flex gap-3"><button type="button" className="text-[12px] underline" onClick={() => setS(init)}>Reset box</button><button type="button" className="text-[12px] underline" onClick={focus}>Focus camera on the car</button></div>
        </div>
      </div>
    </div>
  );
}
