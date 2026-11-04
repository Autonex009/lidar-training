"use client";

import { useEffect, useMemo, useRef } from "react";
import { PointCloudViewer, assetFrameSource, type CuboidOverlay, type FrameSource, type ViewerApi } from "@/components/viewer";
import { classColor, UNLABELED_COLOR } from "@/lib/annotation/colors";
import type { ReferenceData } from "@/lib/annotation/metrics";
import { allCuboids, b64ToU16, cuboidsOf, type AnnotationDocument } from "@/lib/annotation/types";
import type { WorkspaceTask } from "@/lib/tasks/runtime";

export const REF_PREFIX = "ref:";
export const REFERENCE_COLOR = "#ffffff";

/**
 * Read-only point-cloud viewer showing one annotation document (cuboids, segmentation labels) and, optionally, the
 * hidden reference (dashed white cuboids; reference point labels for segmentation tasks). No editing tools are mounted.
 */
export function ReadOnlyAnnotationViewer({
  task, document, reference, showReference, selectedId, frame, onSelect, onFrameChange,
}: {
  task: WorkspaceTask;
  document: AnnotationDocument;
  reference: ReferenceData | null;
  showReference: boolean;
  selectedId: string | null;
  frame: number;
  onSelect: (id: string | null) => void;
  onFrameChange: (i: number) => void;
}) {
  const viewer = useRef<ViewerApi>(null);
  // dev-only hook so scripts/dev-stage5-verify.ts can inspect the scene
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __engine?: unknown }).__engine = viewer.current?.getEngine();
  }, [task.asset.id]);

  const isSeg = task.annotationType === "SEMANTIC_SEG" || task.annotationType === "INSTANCE_SEG";
  const instance = task.annotationType === "INSTANCE_SEG";

  const frames = useMemo<FrameSource>(() => {
    const base = assetFrameSource(task.asset.id, task.asset.frameCount);
    // synthetic caches carry ground-truth labels; the reference toggle is the only way they are shown
    return { frameCount: base.frameCount, load: async (i) => ({ ...(await base.load(i)), labels: undefined }) };
  }, [task.asset.id, task.asset.frameCount]);

  const colors = useMemo(() => {
    const m: Record<string, string> = { "?": "#9ca3af" };
    task.classes.forEach((c, i) => { m[c.name] = classColor(c.name, i); });
    return m;
  }, [task.classes]);

  const overlays = useMemo<CuboidOverlay[]>(() => {
    const own: CuboidOverlay[] = cuboidsOf(document, frame).map((c) => ({ id: c.id, label: c.label, center: c.center, dims: c.dims, yaw: c.yaw, color: colors[c.label] ?? "#9ca3af" }));
    if (!showReference || !reference) return own;
    const refList = reference.frames?.length ? reference.frames.find((f) => f.index === frame)?.cuboids ?? [] : frame === 0 ? reference.cuboids : [];
    return [...own, ...refList.map((c) => ({ id: REF_PREFIX + c.id, label: c.label, center: c.center, dims: c.dims, yaw: c.yaw, color: REFERENCE_COLOR, dashed: true, selectable: false }))];
  }, [document, frame, colors, showReference, reference]);

  const pointLabels = useMemo(() => {
    if (!isSeg) return undefined;
    if (showReference) {
      const b64 = instance ? reference?.pointLabels?.instanceB64 : reference?.pointLabels?.semanticB64;
      return frame === 0 && b64 ? b64ToU16(b64) : undefined;
    }
    const pl = document.pointLabels?.find((p) => p.frame === frame);
    const b64 = instance ? pl?.instance : pl?.semantic;
    return b64 ? b64ToU16(b64) : undefined;
  }, [isSeg, instance, showReference, reference, document, frame]);

  const labelColors = useMemo<Record<number, string>>(() => {
    const m: Record<number, string> = { 0: UNLABELED_COLOR };
    if (instance) for (let i = 1; i < 400; i++) m[i] = classColor("", i * 3 + 1);
    else task.classes.forEach((c, i) => { m[c.classId] = classColor(c.name, i); });
    return m;
  }, [task.classes, instance]);

  const marks = useMemo(() => allCuboids(document).map((x) => x.frame).filter((f, i, a) => a.indexOf(f) === i), [document]);

  return (
    <PointCloudViewer
      ref={viewer} frames={frames} upAxis={task.asset.upAxis} navigationProfile={task.program.navigationProfile} overlays={overlays}
      selectedId={selectedId} onSelect={(id) => onSelect(id && !id.startsWith(REF_PREFIX) ? id : null)} onFrameChange={onFrameChange}
      title={task.asset.name} frameMarks={marks} pointLabels={pointLabels} labelColors={labelColors} colorMode={isSeg ? "label" : undefined}
    />
  );
}
