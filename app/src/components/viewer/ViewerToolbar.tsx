"use client";

import type { ReactNode } from "react";
import type { ColorMode, NavigationProfile, Preset } from "./types";

function Cube({ face }: { face: "all" | "top" | "front" | "side" }) {
  // isometric cube; highlighted face filled
  const f = (on: boolean) => (on ? "currentColor" : "none");
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden>
      <path d="M8 1.5 14 4.8 8 8 2 4.8Z" fill={f(face === "top")} fillOpacity=".55" />
      <path d="M2 4.8 8 8v6.5L2 11.2Z" fill={f(face === "front")} fillOpacity=".55" />
      <path d="M14 4.8 8 8v6.5l6-3.3Z" fill={f(face === "side")} fillOpacity=".55" />
    </svg>
  );
}

const I = {
  reset: <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" />,
  fit: <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />,
  axes: <path d="M8 13V3M8 13l-4.5 1.5M8 13l5-2.5M8 3 6.5 5M8 3 9.5 5" />,
  grid: <path d="M2 5.5h12M2 10.5h12M5.5 2v12M10.5 2v12" />,
  orbit: <><ellipse cx="8" cy="8" rx="6" ry="2.6" /><circle cx="8" cy="8" r="1.2" /></>,
  fly: <path d="M2 8.5 14 3l-3.5 10-2.5-4.2L2 8.5ZM8 8.8 14 3" />,
  prev: <path d="M10 3 5 8l5 5" />,
  next: <path d="M6 3l5 5-5 5" />,
};

function Icon({ d }: { d: ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
}

export function ToolButton({ label, active, onClick, disabled, children, dataTour }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: ReactNode; dataTour?: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} data-tour={dataTour}
        className={`flex h-7 w-7 items-center justify-center rounded border text-ink disabled:opacity-40 ${active ? "border-accent bg-accent-tint" : "border-transparent hover:bg-panel"}`}
      >
        {children}
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink group-hover:block">{label}</span>
    </span>
  );
}

const Sep = () => <span className="mx-1 h-4 w-px bg-line" />;

export interface ViewerToolbarProps {
  colorMode: ColorMode;
  availableModes: ColorMode[];
  pointSize: number;
  showAxes: boolean;
  showGrid: boolean;
  profile: NavigationProfile;
  frameIndex: number;
  frameCount: number;
  title?: string;
  onPreset: (p: Preset) => void;
  onReset: () => void;
  onFit: () => void;
  onPointSize: (n: number) => void;
  onColorMode: (m: ColorMode) => void;
  onAxes: (on: boolean) => void;
  onGrid: (on: boolean) => void;
  onProfile: (p: NavigationProfile) => void;
  onFrame: (i: number) => void;
  children?: ReactNode;
}

const MODE_LABEL: Record<ColorMode, string> = { height: "Height", intensity: "Intensity", rgb: "RGB", label: "Label", flat: "Flat" };

export function ViewerToolbar(p: ViewerToolbarProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-line bg-surface px-2 text-[12px]" data-tour="viewer-toolbar">
      <ToolButton label="Perspective view" onClick={() => p.onPreset("perspective")}><Cube face="all" /></ToolButton>
      <ToolButton label="Top view" onClick={() => p.onPreset("top")}><Cube face="top" /></ToolButton>
      <ToolButton label="Front view" onClick={() => p.onPreset("front")}><Cube face="front" /></ToolButton>
      <ToolButton label="Side view" onClick={() => p.onPreset("side")}><Cube face="side" /></ToolButton>
      <Sep />
      <ToolButton label="Reset camera" dataTour="viewer-reset" onClick={p.onReset}><Icon d={I.reset} /></ToolButton>
      <ToolButton label="Fit to scene" onClick={p.onFit}><Icon d={I.fit} /></ToolButton>
      <Sep />
      <label className="flex items-center gap-1.5 text-muted" title="Point size">
        <span>Size</span>
        <input type="range" min={0.01} max={0.3} step={0.005} value={p.pointSize} onChange={(e) => p.onPointSize(Number(e.target.value))} className="h-1 w-24 accent-[var(--accent)]" aria-label="Point size" />
      </label>
      <select value={p.colorMode} onChange={(e) => p.onColorMode(e.target.value as ColorMode)} aria-label="Colour mode" title="Colour mode" className="ml-2 h-6 rounded border border-line bg-surface px-1 text-[12px] text-ink">
        {p.availableModes.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
      </select>
      <Sep />
      <ToolButton label="Toggle axes" active={p.showAxes} onClick={() => p.onAxes(!p.showAxes)}><Icon d={I.axes} /></ToolButton>
      <ToolButton label="Toggle grid" active={p.showGrid} onClick={() => p.onGrid(!p.showGrid)}><Icon d={I.grid} /></ToolButton>
      <Sep />
      <ToolButton label="Orbit navigation (drag rotate, right-drag pan, wheel zoom)" active={p.profile === "orbit"} onClick={() => p.onProfile("orbit")}><Icon d={I.orbit} /></ToolButton>
      <ToolButton label="Fly navigation (WASD, Q/E, drag to look)" active={p.profile === "fly"} onClick={() => p.onProfile("fly")}><Icon d={I.fly} /></ToolButton>
      {p.children}
      <div className="ml-auto flex items-center gap-1">
        {p.frameCount > 1 && (
          <>
            <ToolButton label="Previous frame" disabled={p.frameIndex <= 0} onClick={() => p.onFrame(p.frameIndex - 1)}><Icon d={I.prev} /></ToolButton>
            <span className="min-w-[56px] text-center tabular-nums text-muted">Frame {p.frameIndex + 1}/{p.frameCount}</span>
            <ToolButton label="Next frame" disabled={p.frameIndex >= p.frameCount - 1} onClick={() => p.onFrame(p.frameIndex + 1)}><Icon d={I.next} /></ToolButton>
          </>
        )}
        {p.title && <span className="ml-2 max-w-[260px] truncate text-muted">{p.title}</span>}
      </div>
    </div>
  );
}
