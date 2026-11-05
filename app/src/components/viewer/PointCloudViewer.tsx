"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { NormalizedCloud } from "@/lib/pointcloud/types";
import { emitTourEvent, onTourEvent } from "@/lib/tour/events";
import { FrameTimeline } from "./FrameTimeline";
import { ViewerEngine } from "./ViewerEngine";
import { ViewerToolbar } from "./ViewerToolbar";
import type { CameraState, ColorMode, ControlKind, CuboidOverlay, FrameSource, NavigationProfile, ViewerApi } from "./types";

export interface PointCloudViewerProps {
  /** Loaded clouds, or a lazy frame source (see assetFrameSource). */
  frames: NormalizedCloud[] | FrameSource;
  upAxis?: "Z" | "Y";
  navigationProfile?: NavigationProfile;
  pointSize?: number;
  showAxes?: boolean;
  showGrid?: boolean;
  colorMode?: ColorMode;
  labelColors?: Record<number, string>;
  pointLabels?: Uint16Array;
  overlays?: CuboidOverlay[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onCameraChange?: (c: CameraState) => void;
  onControlUsed?: (kind: ControlKind, detail?: string) => void;
  onFrameChange?: (index: number) => void;
  showToolbar?: boolean;
  /** Extra toolbar buttons (Annotate stage tools). */
  toolbarExtras?: React.ReactNode;
  /** Frames with annotations (tick marks on the timeline). */
  frameMarks?: number[];
  /** Overlay content rendered inside the canvas area (HUD, banners). */
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

function toSource(frames: NormalizedCloud[] | FrameSource): FrameSource {
  return Array.isArray(frames) ? { frameCount: frames.length, load: async (i) => frames[i] } : frames;
}

export const PointCloudViewer = forwardRef<ViewerApi, PointCloudViewerProps>(function PointCloudViewer(props, ref) {
  const { frames, upAxis = "Z", showToolbar = true } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ViewerEngine | null>(null);
  const handlersRef = useRef(props);
  handlersRef.current = props;

  const [pointSize, setPointSize] = useState(props.pointSize ?? 0.06);
  const [colorMode, setColorMode] = useState<ColorMode>(props.colorMode ?? "height");
  const [showAxes, setShowAxes] = useState(props.showAxes ?? true);
  const [showGrid, setShowGrid] = useState(props.showGrid ?? true);
  const [profile, setProfile] = useState<NavigationProfile>(props.navigationProfile ?? "orbit");
  const [frameIndex, setFrameIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<NormalizedCloud | null>(null);

  const source = useMemo(() => toSource(frames), [frames]);
  const frameCount = source.frameCount;

  // Create / destroy the engine (re-created only when the up axis changes).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const eng = new ViewerEngine(host, { upAxis, navigationProfile: profileInit.current, pointSize: sizeInit.current, showAxes: axesInit.current, showGrid: gridInit.current, colorMode: modeInit.current, labelColors: handlersRef.current.labelColors });
    eng.handlers = {
      onSelect: (id) => handlersRef.current.onSelect?.(id),
      onCameraChange: (c) => handlersRef.current.onCameraChange?.(c),
      onControlUsed: (k, d) => { emitTourEvent(`control:${k}`, d); handlersRef.current.onControlUsed?.(k, d); },
      onFrameChange: (i, c) => { setFrameIndex(i); setLoaded(c); handlersRef.current.onFrameChange?.(i); },
      onError: (e) => setError(e.message),
    };
    engineRef.current = eng;
    // dev-only hooks so e2e scripts can project known scene points to screen coordinates (`__engine` = newest viewer,
    // `__engines` = all live viewers; a page may hold several, e.g. a Learn lesson with two widgets)
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __engine?: unknown; __engines?: ViewerEngine[] };
      w.__engine = eng;
      w.__engines = [...(w.__engines ?? []), eng];
    }
    eng.setFrameSource(sourceInit.current);
    setError(null);
    void eng.setFrame(0);
    return () => {
      if (process.env.NODE_ENV !== "production") { const w = window as unknown as { __engines?: ViewerEngine[] }; w.__engines = (w.__engines ?? []).filter((x) => x !== eng); }
      eng.dispose();
      engineRef.current = null;
    };
  }, [upAxis]);

  const profileInit = useRef(profile), sizeInit = useRef(pointSize), axesInit = useRef(showAxes), gridInit = useRef(showGrid), modeInit = useRef(colorMode), sourceInit = useRef(source);
  sourceInit.current = source;

  // New frames input -> reload.
  const firstSource = useRef(true);
  useEffect(() => {
    if (firstSource.current) { firstSource.current = false; return; }
    const eng = engineRef.current;
    if (!eng) return;
    eng.setFrameSource(source);
    void eng.setFrame(0);
  }, [source]);

  useEffect(() => { if (props.pointSize !== undefined) { setPointSize(props.pointSize); engineRef.current?.setPointSize(props.pointSize); } }, [props.pointSize]);
  useEffect(() => { if (props.colorMode) { setColorMode(props.colorMode); engineRef.current?.setColorMode(props.colorMode); } }, [props.colorMode]);
  useEffect(() => { if (props.showAxes !== undefined) { setShowAxes(props.showAxes); engineRef.current?.setShowAxes(props.showAxes); } }, [props.showAxes]);
  useEffect(() => { if (props.showGrid !== undefined) { setShowGrid(props.showGrid); engineRef.current?.setShowGrid(props.showGrid); } }, [props.showGrid]);
  useEffect(() => { if (props.navigationProfile) { setProfile(props.navigationProfile); engineRef.current?.setNavigationProfile(props.navigationProfile); } }, [props.navigationProfile]);
  useEffect(() => { if (props.labelColors) engineRef.current?.setLabelColors(props.labelColors); }, [props.labelColors]);
  useEffect(() => { engineRef.current?.setPointLabels(props.pointLabels ?? null); }, [props.pointLabels, loaded]);
  useEffect(() => { engineRef.current?.setOverlays(props.overlays ?? []); engineRef.current?.setSelectedId(handlersRef.current.selectedId ?? null); }, [props.overlays, upAxis]);
  useEffect(() => { engineRef.current?.setSelectedId(props.selectedId ?? null); }, [props.selectedId]);

  const setFrame = useCallback((i: number) => engineRef.current?.setFrame(i) ?? Promise.resolve(), []);
  /** User-driven frame change (toolbar, timeline, arrow keys): also reported to guided tours. */
  const userFrame = useCallback((i: number, from: number) => {
    emitTourEvent("control:frame", i > from ? "next" : "prev");
    return setFrame(i);
  }, [setFrame]);

  // Guided tours can ask the viewer to switch navigation profile (e.g. fly mode for WASD).
  useEffect(() => onTourEvent((e) => {
    if (e.name !== "viewer:profile") return;
    const p = e.detail === "fly" ? "fly" : "orbit";
    setProfile(p);
    engineRef.current?.setNavigationProfile(p);
  }), []);

  // Left / right arrow keys step through frames (only while no object is selected, so box nudging keeps working).
  const frameRef = useRef({ frameIndex, frameCount });
  frameRef.current = { frameIndex, frameCount };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const { frameIndex: fi, frameCount: fc } = frameRef.current;
      if (fc < 2 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || handlersRef.current.selectedId) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const eng = engineRef.current;
      const active = document.activeElement === eng?.canvas || eng?.isHovered;
      if (!active) return;
      const next = Math.max(0, Math.min(fc - 1, fi + (e.key === "ArrowRight" ? 1 : -1)));
      if (next === fi) return;
      e.preventDefault();
      void userFrame(next, fi);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [userFrame]);

  useImperativeHandle(ref, () => ({
    setPreset: (p) => engineRef.current?.setPreset(p),
    resetCamera: () => engineRef.current?.resetCamera(),
    fitToBounds: () => engineRef.current?.fitToBounds(),
    setPointSize: (n) => { setPointSize(n); engineRef.current?.setPointSize(n); },
    setColorMode: (m) => { setColorMode(m); engineRef.current?.setColorMode(m); },
    setFrame,
    getCamera: () => engineRef.current!.getCamera(),
    screenshot: () => engineRef.current?.screenshot() ?? "",
    setHiddenLabels: (s) => engineRef.current?.setHiddenLabels(s),
    getEngine: () => engineRef.current!,
  }), [setFrame]);

  const availableModes = useMemo<ColorMode[]>(() => {
    const m: ColorMode[] = ["height"];
    if (loaded?.intensity) m.push("intensity");
    if (loaded?.colors) m.push("rgb");
    if (props.pointLabels || loaded?.labels) m.push("label");
    m.push("flat");
    return m;
  }, [loaded, props.pointLabels]);

  return (
    <div className={`flex h-full min-h-[320px] w-full flex-col overflow-hidden border border-line bg-surface ${props.className ?? ""}`}>
      {showToolbar && (
        <ViewerToolbar
          colorMode={colorMode} availableModes={availableModes} pointSize={pointSize} showAxes={showAxes} showGrid={showGrid}
          profile={profile} frameIndex={frameIndex} frameCount={frameCount} title={props.title}
          onPreset={(p) => engineRef.current?.setPreset(p)}
          onReset={() => engineRef.current?.resetCamera()}
          onFit={() => engineRef.current?.fitToBounds()}
          onPointSize={(n) => { setPointSize(n); engineRef.current?.setPointSize(n); }}
          onColorMode={(m) => { setColorMode(m); engineRef.current?.setColorMode(m); }}
          onAxes={(on) => { setShowAxes(on); engineRef.current?.setShowAxes(on); }}
          onGrid={(on) => { setShowGrid(on); engineRef.current?.setShowGrid(on); }}
          onProfile={(p) => { setProfile(p); engineRef.current?.setNavigationProfile(p); }}
          onFrame={(i) => void userFrame(i, frameIndex)}
        >
          {props.toolbarExtras}
        </ViewerToolbar>
      )}
      <div className="relative min-h-0 flex-1 bg-viewer" data-tour="viewer-canvas">
        <div ref={hostRef} className="absolute inset-0" />
        {!loaded && !error && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#9ca3af]">Loading point cloud…</div>}
        {props.children}
        {error && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#ff7a7a]">{error}</div>}
        {profile === "fly" && <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-[11px] text-[#d4d4d4]">WASD move · Q/E elevate · Shift faster · drag look · ⌘/Ctrl+click set target</div>}
        {loaded?.metadata?.synthetic === true && <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#c6f135]">DEMO / SYNTHETIC TRAINING DATA</div>}
      </div>
      {frameCount > 1 && <FrameTimeline frameIndex={frameIndex} frameCount={frameCount} marks={props.frameMarks} onFrame={(i) => void userFrame(i, frameIndex)} />}
    </div>
  );
});
