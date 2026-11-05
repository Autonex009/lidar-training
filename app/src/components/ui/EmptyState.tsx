import type { ReactNode } from "react";

type Variant = "cloud" | "checklist" | "inbox";

function Illustration({ variant }: { variant: Variant }) {
  const common = { width: 96, height: 72, viewBox: "0 0 96 72", fill: "none", "aria-hidden": true } as const;
  if (variant === "checklist")
    return (
      <svg {...common}>
        <rect x="22" y="6" width="52" height="60" rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
        {[20, 34, 48].map((y, i) => (
          <g key={y}>
            <rect x="31" y={y} width="9" height="9" rx="3" fill={i === 0 ? "var(--accent)" : "var(--accent-tint)"} stroke={i === 0 ? "none" : "var(--line)"} />
            {i === 0 ? <path d="m33 24.5 2 2 3-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> : null}
            <rect x="46" y={y + 2} width={i === 1 ? 18 : 22} height="5" rx="2.5" fill="var(--line)" />
          </g>
        ))}
      </svg>
    );
  if (variant === "inbox")
    return (
      <svg {...common}>
        <path d="M14 40 24 14h48l10 26v16a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V40Z" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 40h22a4 4 0 0 1 4 4 8 8 0 0 0 16 0 4 4 0 0 1 4-4h22" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="48" cy="26" r="5" fill="var(--accent-tint)" stroke="var(--accent)" strokeWidth="1.6" />
      </svg>
    );
  const pts: [number, number, number][] = [[24, 44, 2], [32, 30, 3], [44, 38, 2], [52, 22, 3], [60, 34, 2], [70, 46, 3], [40, 52, 2], [64, 18, 2], [30, 56, 2]];
  return (
    <svg {...common}>
      <rect x="10" y="10" width="76" height="54" rx="10" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
      {pts.map(([x, y, r], i) => <circle key={i} cx={x + 4} cy={y} r={r} fill={i % 3 === 0 ? "var(--grad-from)" : "var(--accent)"} opacity={i % 2 ? 0.55 : 0.9} />)}
      <path d="M36 28 58 22l8 14-22 6-8-14Z" stroke="var(--grad-to)" strokeWidth="1.5" strokeDasharray="3 2" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ title, description, action, variant = "inbox" }: { title: string; description?: string; action?: ReactNode; variant?: Variant }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <Illustration variant={variant} />
      <p className="mt-2 text-[16px] font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-[14px] text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
