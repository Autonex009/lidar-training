import type { ReactNode } from "react";
import Link from "next/link";

export const inputCls = "h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-ink";
export const areaCls = "w-full rounded-md border border-line bg-surface p-2 font-mono text-[12px] text-ink outline-none focus:border-ink";
export const linkCls = "text-ink underline decoration-line underline-offset-2 hover:decoration-ink";

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between border-b border-line pb-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-muted">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-2 py-1.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top">{children}</tbody>
      </table>
      {empty ? <p className="px-2 py-3 text-[13px] text-muted">{empty}</p> : null}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav className="mb-4 flex gap-1 border-b border-line text-[13px]">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={`-mb-px border-b-2 px-3 py-1.5 ${t.key === current ? "border-ink font-medium" : "border-transparent text-muted hover:text-ink"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}

export const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-");

export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warn" | "ok" }) {
  const c = tone === "warn" ? "border-warning/40 bg-warning/10 text-warning-ink" : tone === "ok" ? "border-success/30 bg-success/10 text-success-ink" : "border-line bg-panel text-muted";
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
}
