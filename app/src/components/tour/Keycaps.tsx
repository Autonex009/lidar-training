"use client";

import type { ReactNode } from "react";
import type { GlyphId, KeycapSpec } from "./types";

const cap = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-line border-b-[3px] bg-surface px-2.5 text-[15px] font-medium text-ink";

const svg = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

function glyphBody(g: GlyphId): ReactNode {
  switch (g) {
    case "mouse-left": return svg(<><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 3v7M6 10h12" /><path d="M6.6 9.5V8a5.4 5.4 0 0 1 5.4-5v7z" fill="currentColor" stroke="none" opacity=".8" /></>);
    case "mouse-right": return svg(<><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 3v7M6 10h12" /><path d="M17.4 9.5V8A5.4 5.4 0 0 0 12 3v7z" fill="currentColor" stroke="none" opacity=".8" /></>);
    case "wheel": return svg(<><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" /><path d="m3 9 1.5-1.5L6 9M3 15l1.5 1.5L6 15" /></>);
    case "trackpad-scroll": return svg(<><path d="M9 20v-9a1.5 1.5 0 0 1 3 0v-2a1.5 1.5 0 0 1 3 0v2a1.5 1.5 0 0 1 3 0v5c0 2.5-1.5 4-4 4H11c-1 0-1.6-.5-2-1.5L6.5 14c-.5-1 .8-1.9 1.6-1l.9 1" /><path d="M5 5V2M3.5 3.5 5 2l1.5 1.5" /></>);
    case "trackpad-pinch": return svg(<><path d="M10 14l-5 5M5 15v4h4M14 10l5-5M15 5h4v4" /></>);
    case "click": return svg(<><path d="M6 3l12 6.5-5 1.8-2 5z" /></>);
    case "arrow-left": return <span aria-hidden>←</span>;
    case "arrow-right": return <span aria-hidden>→</span>;
    case "arrow-up": return <span aria-hidden>↑</span>;
    case "arrow-down": return <span aria-hidden>↓</span>;
    case "shift": return <span aria-hidden>⇧</span>;
    case "cmd": return <span aria-hidden>⌘</span>;
    case "ctrl": return <span aria-hidden className="text-[13px]">Ctrl</span>;
    case "alt": return <span aria-hidden className="text-[13px]">Alt</span>;
  }
}

const GLYPH_LABEL: Record<GlyphId, string> = {
  "mouse-left": "Left mouse button", "mouse-right": "Right mouse button", wheel: "Mouse wheel", "trackpad-scroll": "Two-finger scroll", "trackpad-pinch": "Pinch",
  shift: "Shift", cmd: "Command", ctrl: "Control", alt: "Alt", "arrow-left": "Left arrow", "arrow-right": "Right arrow", "arrow-up": "Up arrow", "arrow-down": "Down arrow", click: "Click",
};

export function KeycapRow({ keys, active }: { keys: KeycapSpec[]; active?: boolean }) {
  // Keep the classic W / A S D layout when exactly those four keys are given.
  const wasd = keys.length === 4 && ["W", "A", "S", "D"].every((k) => keys.includes(k));
  const tone = active ? "border-accent bg-accent-tint" : "";
  if (wasd) {
    return (
      <div className="inline-grid grid-cols-[repeat(3,2.25rem)] gap-1.5" data-testid="tour-keycaps">
        <span /><kbd className={`${cap} ${tone} font-sans`}>W</kbd><span />
        <kbd className={`${cap} ${tone} font-sans`}>A</kbd><kbd className={`${cap} ${tone} font-sans`}>S</kbd><kbd className={`${cap} ${tone} font-sans`}>D</kbd>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="tour-keycaps">
      {keys.map((k, i) =>
        k === "+" ? <span key={i} className="text-[12px] text-muted">+</span>
        : typeof k === "string" ? <kbd key={i} className={`${cap} ${tone} font-sans`}>{k}</kbd>
        : <span key={i} role="img" aria-label={GLYPH_LABEL[k.glyph]} className={`${cap} ${tone}`}>{glyphBody(k.glyph)}</span>)}
    </div>
  );
}
