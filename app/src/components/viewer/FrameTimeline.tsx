"use client";

import { useEffect, useRef, useState } from "react";

export interface FrameTimelineProps {
  frameIndex: number;
  frameCount: number;
  onFrame: (i: number) => void;
  /** Frames to show as tick marks (e.g. frames with annotations). */
  marks?: number[];
}

const SPEEDS = [0.5, 1, 2, 4];

export function FrameTimeline({ frameIndex, frameCount, onFrame, marks }: FrameTimelineProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const idx = useRef(frameIndex);
  idx.current = frameIndex;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const n = idx.current + 1;
      if (n >= frameCount) setPlaying(false);
      else onFrame(n);
    }, 700 / speed);
    return () => clearInterval(t);
  }, [playing, speed, frameCount, onFrame]);

  const btn = "flex h-7 w-7 items-center justify-center rounded border border-transparent text-ink hover:bg-panel disabled:opacity-40";
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-t border-line bg-surface px-3 text-[12px] text-muted">
      <button type="button" className={btn} aria-label="Previous frame" disabled={frameIndex <= 0} onClick={() => onFrame(frameIndex - 1)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2h1.5v10H3zM12 2v10L5.5 7z" /></svg>
      </button>
      <button type="button" className={btn} aria-label={playing ? "Pause" : "Play"} onClick={() => { if (!playing && frameIndex >= frameCount - 1) onFrame(0); setPlaying(!playing); }}>
        {playing
          ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2h3v10H3zM8 2h3v10H8z" /></svg>
          : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11L12 7z" /></svg>}
      </button>
      <button type="button" className={btn} aria-label="Next frame" disabled={frameIndex >= frameCount - 1} onClick={() => onFrame(frameIndex + 1)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M9.5 2H11v10H9.5zM2 2v10l6.5-5z" /></svg>
      </button>
      <span className="w-4 text-right tabular-nums">0</span>
      <div className="relative flex-1">
        <input type="range" min={0} max={Math.max(0, frameCount - 1)} step={1} value={frameIndex} onChange={(e) => onFrame(Number(e.target.value))} aria-label="Frame" className="w-full accent-[#8aa81d]" />
        {marks && frameCount > 1 && (
          <div className="pointer-events-none absolute inset-x-0 -bottom-1 h-1">
            {marks.map((m) => <span key={m} className="absolute h-1 w-px bg-muted" style={{ left: `${(m / (frameCount - 1)) * 100}%` }} />)}
          </div>
        )}
      </div>
      <span className="w-6 tabular-nums">{frameCount - 1}</span>
      <span className="tabular-nums text-ink">Frame {frameIndex + 1}</span>
      <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed" className="h-6 rounded border border-line bg-surface px-1 text-ink">
        {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
      </select>
    </div>
  );
}
