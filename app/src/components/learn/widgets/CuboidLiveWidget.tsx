"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Vector3 } from "three";
import { CuboidTool, type ToolMode } from "@/components/annotate/CuboidTool";
import { usePageTours } from "@/components/tour/PageTours";
import { useTourOptional } from "@/components/tour/TourProvider";
import { Button } from "@/components/ui/Button";
import { PointCloudViewer, assetFrameSource, type CuboidOverlay, type ViewerApi } from "@/components/viewer";
import { classColor, UNLABELED_COLOR } from "@/lib/annotation/colors";
import { fitCuboidToPoints } from "@/lib/annotation/fit";
import { nudgeCuboid } from "@/lib/annotation/nudge";
import { editorReducer, initEditor, newId, type Edit } from "@/lib/annotation/reducer";
import { cuboidsOf, emptyDocument, type Cuboid } from "@/lib/annotation/types";
import { classifyMistakes, classifyPatch, FIT_PASS_IOU, fitQuality, mistakeSummary, type FitQuality } from "@/lib/learn/interactive";
import { emitTourEvent } from "@/lib/tour/events";
import { BoxTags } from "./BoxTags";
import { MistakeOverlay, PulseBox } from "./overlays3d";
import { Feedback } from "./Parts";
import type { ReferenceBox } from "./CuboidWidget";
import type { AssetRef, WidgetProps } from "./types";


const CLASSES = ["Vehicle", "Pedestrian", "Cyclist", "Pole"];
const UNLABELLED = "?";
const colorOf = (l: string) => (l === UNLABELLED ? UNLABELED_COLOR : classColor(l, CLASSES.indexOf(l)));
const isTyping = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };

/**
 * The real cuboid tools (create by drag, select, move, resize handles, rotate, fit to points) on a demo scene,
 * with one target object highlighted and a live fit-quality readout against the hidden reference box.
 * Checkpoints: created, moved, resized, rotated, fit (IoU >= 0.7), label.
 */
export function CuboidLiveWidget({ onDone, instructions, asset, reference }: WidgetProps & { asset: AssetRef | null; reference: ReferenceBox | null }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const ref = reference;
  const api = useRef<ViewerApi>(null);
  const root = useRef<HTMLDivElement>(null);
  const tool = useRef<CuboidTool | null>(null);
  const mistakes = useRef<MistakeOverlay | null>(null);
  const tour = useTourOptional();
  usePageTours(["lesson-cuboid"]);

  const [state, dispatch] = useReducer(editorReducer, undefined, () => initEditor(emptyDocument()));
  const doc = state.history.present;
  const selectedId = state.selectedId;
  const cubs = cuboidsOf(doc, 0);
  const selected = cubs.find((c) => c.id === selectedId) ?? null;
  const [mode, setMode] = useState<ToolMode>("create");
  const [showMistakes, setShowMistakes] = useState(false);
  const [solved, setSolved] = useState(false);

  const live = useRef({ doc, selectedId, mode });
  live.current = { doc, selectedId, mode };
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const changeMode = useCallback((m: ToolMode) => setMode(m), []);

  /** Every edit also reports what it really changed to the checkpoints and to the guided steps. */
  const edit = useCallback((e: Edit, select?: string | null) => {
    if (e.type === "addCuboid") {
      onDoneRef.current("created");
      emitTourEvent("lc:created");
    } else if (e.type === "patchCuboid") {
      const prev = cuboidsOf(live.current.doc, 0).find((c) => c.id === e.id);
      if (prev) {
        const k = classifyPatch(prev, e.patch);
        if (k.moved) { onDoneRef.current("moved"); emitTourEvent("lc:moved"); }
        if (k.resized) { onDoneRef.current("resized"); emitTourEvent("lc:resized"); }
        if (k.rotated) { onDoneRef.current("rotated"); emitTourEvent("lc:rotated"); }
        if (k.relabelled) {
          emitTourEvent("lc:labelled");
          if (e.patch.label === ref?.label) onDoneRef.current("label");
        }
      }
    }
    dispatch({ type: "edit", edit: e, select });
  }, [ref?.label]);

  const groundZ = () => api.current?.getEngine().groundLevel ?? 0;
  const positions = () => api.current?.getEngine().getCloud()?.positions ?? null;

  const fit = useCallback(() => {
    const sel = cuboidsOf(live.current.doc, 0).find((c) => c.id === live.current.selectedId);
    const eng = api.current?.getEngine();
    const pos = eng?.getCloud()?.positions;
    if (!sel || !eng || !pos) return;
    const r = fitCuboidToPoints(pos, sel, { margin: 0.3, groundZ: eng.groundLevel, headroom: 0.3 });
    if (r) edit({ type: "patchCuboid", frame: 0, id: sel.id, patch: { center: r.center, dims: r.dims } });
    emitTourEvent("lc:fit-clicked");
  }, [edit]);

  const remove = () => { if (selected) edit({ type: "deleteCuboid", frame: 0, id: selected.id }); };

  // ---- tool + helper overlays ----
  useEffect(() => {
    const eng = api.current?.getEngine();
    if (!eng) return;
    const t = new CuboidTool(eng, {
      readOnly: () => false,
      selected: () => cuboidsOf(live.current.doc, 0).find((c) => c.id === live.current.selectedId) ?? null,
      cuboids: () => cuboidsOf(live.current.doc, 0),
      defaultDims: () => undefined,
      // raw box on creation: the learner refines it (rotate, then fit) instead of getting an automatic fit
      positions: () => null,
      isHidden: () => false,
      onCreate: (b) => {
        const id = newId("c");
        const c: Cuboid = { id, label: UNLABELLED, center: b.center, dims: b.dims, yaw: b.yaw, attributes: {} };
        edit({ type: "addCuboid", frame: 0, cuboid: c }, id);
        setMode("select");
      },
      onPatch: (id, patch) => edit({ type: "patchCuboid", frame: 0, id, patch }),
      onSelect: (id) => dispatch({ type: "select", id }),
      onClickPoint: () => undefined,
      onPaint: () => undefined,
      onStrokeStart: () => undefined,
      onStrokeEnd: () => undefined,
    });
    tool.current = t;
    t.setMode(live.current.mode);
    const pulse = ref ? new PulseBox(eng, ref) : null;
    const mo = new MistakeOverlay(eng);
    mistakes.current = mo;
    return () => { t.dispose(); tool.current = null; pulse?.dispose(); mo.dispose(); mistakes.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { tool.current?.setMode(mode); }, [mode]);
  useEffect(() => { tool.current?.syncSelection(); }, [doc, selectedId, mode]);

  // ---- fit quality (selected box, else the best one) ----
  const quality = useMemo(() => {
    if (!ref) return null;
    const pool = selected ? [selected] : cubs;
    let best: { c: Cuboid; q: FitQuality } | null = null;
    for (const c of pool) { const q = fitQuality(c, ref); if (!best || q.iou > best.q.iou) best = { c, q }; }
    return best;
  }, [ref, selected, cubs]);
  const bestIou = useMemo(() => (ref ? Math.max(0, ...cubs.map((c) => fitQuality(c, ref).iou)) : 0), [ref, cubs]);
  useEffect(() => { if (bestIou >= FIT_PASS_IOU) { onDoneRef.current("fit"); setSolved(true); } }, [bestIou]);

  // ---- mistakes overlay ----
  const verdict = useMemo(() => {
    const pos = positions();
    const target = quality?.c;
    if (!showMistakes || !target || !pos) return null;
    return classifyMistakes(pos, target, { groundZ: groundZ() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMistakes, quality?.c, doc]);
  useEffect(() => { mistakes.current?.set(verdict && quality ? quality.c : null, verdict); }, [verdict, quality]);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      // lesson pages have no other single-key shortcuts, so these work wherever the pointer or focus is
      // (the guided-step dialog takes focus when its buttons are clicked)
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (ctrl && k.toLowerCase() === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); return; }
      if (k === "Escape") { dispatch({ type: "select", id: null }); setMode("select"); return; }
      const sel = cuboidsOf(live.current.doc, 0).find((c) => c.id === live.current.selectedId) ?? null;
      if ((k === "Delete" || k === "Backspace") && sel) { e.preventDefault(); edit({ type: "deleteCuboid", frame: 0, id: sel.id }); return; }
      if (!ctrl && !e.altKey) {
        const low = k.toLowerCase();
        if (low === "c") { setMode("create"); return; }
        if (low === "v") { setMode("select"); return; }
        if (low === "m") { setMode("move"); return; }
        if (low === "g" && sel) { fit(); return; }
      }
      if (sel) {
        const patch = nudgeCuboid(sel, { key: k, shift: e.shiftKey, ctrl });
        if (patch) { e.preventDefault(); edit({ type: "patchCuboid", frame: 0, id: sel.id, patch }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit, fit]);

  // ---- camera ----
  const focus = useCallback(() => {
    const eng = api.current?.getEngine();
    if (!eng || !ref) return;
    eng.camera.position.copy(eng.root.localToWorld(new Vector3(...ref.center))).add(new Vector3(2, 12, 4));
    eng.setTarget(ref.center);
  }, [ref]);

  const overlays = useMemo<CuboidOverlay[]>(() => cubs.map((c) => ({ id: c.id, label: c.label, center: c.center, dims: c.dims, yaw: c.yaw, color: colorOf(c.label) })), [cubs]);
  const tags = useMemo(() => cubs.map((c) => ({ id: c.id, text: c.label === UNLABELLED ? "unlabelled" : c.label, pos: [c.center[0], c.center[1], c.center[2] + c.dims[2] / 2 + 0.25] as [number, number, number], color: colorOf(c.label) })), [cubs]);
  const getEngine = useCallback(() => api.current?.getEngine() ?? null, []);

  if (!ref || !frames) return <p className="text-[13px] text-muted">Demo scene not available.</p>;
  const sum = verdict ? mistakeSummary(verdict) : null;
  const toolBtn = (m: ToolMode, label: string, key: string) => (
    <Button key={m} variant={mode === m ? "primary" : "secondary"} aria-pressed={mode === m} data-testid={`lc-tool-${m}`} onClick={() => changeMode(m)}>{label} <kbd className="ml-1 font-sans text-[12px] text-muted">{key}</kbd></Button>
  );

  return (
    <div ref={root} data-testid="cuboid-live">
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" data-tour="lc-tools">
        {toolBtn("create", "Create", "C")}
        {toolBtn("select", "Select / resize", "V")}
        {toolBtn("move", "Move", "M")}
        {toolBtn("rotate", "Rotate", "R")}
        <Button data-tour="lc-fit" data-testid="lc-fit" disabled={!selected} onClick={fit}>Fit to points <kbd className="ml-1 font-sans text-[12px] text-muted">G</kbd></Button>
        <Button data-testid="lc-delete" disabled={!selected} onClick={remove}>Delete</Button>
        <label className="ml-1 flex items-center gap-1.5 text-[13px]" data-tour="lc-label">Label
          <select aria-label="Label" data-testid="lc-label" disabled={!selected} value={selected?.label ?? UNLABELLED} onChange={(e) => selected && edit({ type: "patchCuboid", frame: 0, id: selected.id, patch: { label: e.target.value } })} className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] disabled:opacity-50">
            <option value={UNLABELLED}>? (none)</option>
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="ml-1 flex items-center gap-1.5 text-[13px]" data-tour="lc-mistakes"><input type="checkbox" data-testid="lc-mistakes" checked={showMistakes} onChange={(e) => setShowMistakes(e.target.checked)} />Show my mistakes</label>
        {tour ? <Button className="ml-auto" data-testid="start-cuboid-tour" onClick={() => tour.startTour("lesson-cuboid", { force: true })}>Guided steps</Button> : null}
      </div>
      <div className="h-[430px]" data-tour="lc-canvas">
        <PointCloudViewer ref={api} frames={frames} overlays={overlays} selectedId={selectedId} onSelect={(id) => dispatch({ type: "select", id })} onFrameChange={() => setTimeout(focus, 50)} title="Fit a box to the pulsing car">
          <BoxTags getEngine={getEngine} tags={tags} />
        </PointCloudViewer>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start" data-testid="fit-readout">
        <div className="text-[13px]">
          {quality ? (
            <>
              <span>Fit vs reference: IoU <b data-testid="fit-iou" className={quality.q.iou >= FIT_PASS_IOU ? "text-success" : ""}>{quality.q.iou.toFixed(2)}</b> (need {FIT_PASS_IOU.toFixed(2)})</span>
              <span className="mx-2 text-muted">·</span><span>Center error <b data-testid="fit-center">{quality.q.centerErr.toFixed(2)} m</b></span>
              <span className="mx-2 text-muted">·</span><span>Yaw error <b data-testid="fit-yaw">{quality.q.yawErrDeg.toFixed(1)}°</b></span>
            </>
          ) : <span className="text-muted">Draw a box around the pulsing car to see how well it fits.</span>}
        </div>
        {showMistakes ? (
          <div className="flex items-center gap-3 text-[12px]" data-testid="mistake-legend">
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 bg-[#ff3b3b]" />cuts points{sum ? ` (${sum.cuts})` : ""}</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 bg-[#ffd60a]" />&gt;20% empty margin{sum ? ` (${sum.margins})` : ""}</span>
          </div>
        ) : null}
      </div>
      {solved ? <div className="mt-2"><Feedback tone="good">Fit is 0.70 or better. Check the label, then try the mistakes overlay.</Feedback></div> : null}
    </div>
  );
}
