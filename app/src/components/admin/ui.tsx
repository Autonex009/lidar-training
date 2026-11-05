import type { ReactNode } from "react";
import Link from "next/link";

export const inputCls = "h-9 rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-accent focus:ring-[3px] focus:ring-[var(--ring)]";
export const areaCls = "w-full rounded-[10px] border border-line bg-surface p-3 font-mono text-[12px] text-ink outline-none focus:border-accent";
export const linkCls = "text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent";

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px] [&_tbody_tr:hover]:bg-panel">
        <thead>
          <tr className="text-[12px] uppercase tracking-wide text-muted">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap border-b border-line bg-panel px-4 py-3 font-semibold first:rounded-tl-lg last:rounded-tr-lg">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-b-0 [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top">{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-4 text-[14px] text-muted">{empty}</p> : null}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-2 text-[14px]">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={`inline-flex h-9 items-center rounded-full border px-4 font-medium ${t.key === current ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:bg-panel"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}

export const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-");

export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warn" | "ok" }) {
  const c = tone === "warn" ? "border-warning/40 bg-warning/10 text-warning-ink" : tone === "ok" ? "border-success/30 bg-success/10 text-success-ink" : "border-line bg-panel text-muted";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${c}`}>{children}</span>;
}
