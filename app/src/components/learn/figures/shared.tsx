import type { ReactNode } from "react";

export const C = { ink: "#111", mute: "#9ca3af", line: "#d1d5db", red: "#e5484d", green: "#4caf50", blue: "#3b82f6", acc: "#c6f135", fill: "#f5f5f5" };

/** Common frame for all line-diagram figures. */
export function Fig({ children, label, h = 180 }: { children: ReactNode; label: string; h?: number }) {
  return (
    <svg viewBox={`0 0 360 ${h}`} role="img" aria-label={label} className="h-auto w-full max-w-[520px] border border-line bg-surface" fontSize="9.5" fontFamily="inherit">
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8z" fill="context-stroke" /></marker>
      </defs>
      {children}
    </svg>
  );
}

export const Dots = ({ pts, r = 1.8, fill = C.ink }: { pts: [number, number][]; r?: number; fill?: string }) => (
  <>{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill} />)}</>
);

/** Deterministic dots in a rectangle (no randomness so SSR matches). */
export function grid(x: number, y: number, w: number, h: number, nx: number, ny: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push([x + (w * (i + 0.5)) / nx, y + (h * (j + 0.5)) / ny]);
  return out;
}
