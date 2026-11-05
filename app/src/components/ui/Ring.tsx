import { useId } from "react";

/** Circular progress ring with the percentage inside. Server- and client-safe. */
export function Ring({ value, size = 28, stroke, label, className = "" }: { value: number; size?: number; stroke?: number; label?: string; className?: string }) {
  const id = useId();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const sw = stroke ?? (size >= 56 ? 6 : size >= 40 ? 4 : 2);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const fontSize = size >= 56 ? 15 : size >= 40 ? 13 : 12;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }} role="img" aria-label={label ?? `${pct}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--grad-from)" />
            <stop offset="1" stopColor="var(--grad-to)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="absolute font-semibold tabular-nums tracking-tighter text-ink" style={{ fontSize, letterSpacing: size < 40 ? (pct === 100 ? "-0.1em" : "-0.06em") : undefined }} aria-hidden>
        <>{pct}%</>
      </span>
    </span>
  );
}
