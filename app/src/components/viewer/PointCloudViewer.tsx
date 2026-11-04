"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { NormalizedCloud } from "@/lib/pointcloud/types";
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
      onControlUsed: (k, d) => handlersRef.current.onControlUsed?.(k, d),
      onFrameChange: (i, c) => { setFrameIndex(i); setLoaded(c); handlersRef.current.onFrameChange?.(i); },
      onError: (e) => setError(e.message),
    };
    engineRef.current = eng;
    eng.setFrameSource(sourceInit.current);
    setError(null);
    void eng.setFrame(0);
    return () => { eng.dispose(); engineRef.current = null; };
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
          onFrame={(i) => void setFrame(i)}
        >
          {props.toolbarExtras}
        </ViewerToolbar>
      )}
      <div className="relative min-h-0 flex-1 bg-viewer">
        <div ref={hostRef} className="absolute inset-0" />
        {!loaded && !error && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#9ca3af]">Loading point cloud…</div>}
        {error && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#ff7a7a]">{error}</div>}
        {profile === "fly" && <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-[11px] text-[#d4d4d4]">WASD move · Q/E elevate · Shift faster · drag look · ⌘/Ctrl+click set target</div>}
        {loaded?.metadata?.synthetic === true && <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#c6f135]">DEMO / SYNTHETIC TRAINING DATA</div>}
      </div>
      {frameCount > 1 && <FrameTimeline frameIndex={frameIndex} frameCount={frameCount} onFrame={(i) => void setFrame(i)} />}
    </div>
  );
});
