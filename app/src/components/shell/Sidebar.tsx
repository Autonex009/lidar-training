"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/Brand";
import { Tooltip } from "@/components/ui/Tooltip";
import { UIcon, type IconName } from "@/components/ui/Icons";

export interface NavItem {
  href: string;
  label: string;
  icon: "learn" | "annotate" | "review" | "complete" | "admin";
  locked: boolean;
  lockReason?: string;
  /** Small count shown next to the label (e.g. pending reviews for staff). */
  badge?: number;
}

const ICON: Record<NavItem["icon"], IconName> = { learn: "learn", annotate: "annotate", review: "review", complete: "complete", admin: "admin" };

/** Opens the existing Help menu (the "?" in the top bar) so there is one source of truth for tutorials. */
function openHelp() {
  document.querySelector<HTMLButtonElement>('[data-testid="help-button"]')?.click();
}

export function Sidebar({ items, name, role }: { items: NavItem[]; name: string; role: string }) {
  const pathname = usePathname();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
  const staged = items.filter((i) => i.icon !== "admin");
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[250px] flex-col border-r border-line bg-surface">
      <div className="flex h-14 items-center border-b border-line px-4 text-[15px]"><Wordmark /></div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Primary" data-tour="sidebar">
        <p className="px-2.5 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Training</p>
        {items.map((item) => {
          const step = staged.indexOf(item);
          const base = "relative flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[14px]";
          const num = step >= 0 ? <span aria-hidden className="w-5 shrink-0 text-[12px] font-semibold tabular-nums text-muted">{String(step + 1).padStart(2, "0")}</span> : <span className="w-5 shrink-0" />;
          if (item.locked) {
            return (
              <Tooltip key={item.href} text={item.lockReason ?? "Locked"}>
                <span aria-disabled="true" data-tour={`sidebar-${item.icon}`} className={`${base} cursor-not-allowed text-muted/70`}>
                  {num}
                  <UIcon name={ICON[item.icon]} size={17} />
                  <span className="flex-1">{item.label}</span>
                  <UIcon name="lock" size={14} label="Locked" />
                </span>
              </Tooltip>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`sidebar-${item.icon}`}
              className={`${base} ${active ? "bg-accent-tint font-semibold text-accent before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-accent" : "text-ink hover:bg-panel"}`}
              aria-current={active ? "page" : undefined}
            >
              {num}
              <UIcon name={ICON[item.icon]} size={17} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span data-testid={`nav-badge-${item.label}`} className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[12px] leading-5 text-white">{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-line p-3">
        <button type="button" onClick={openHelp} className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] text-ink hover:bg-panel">
          <span className="w-5 shrink-0" />
          <UIcon name="help" size={17} />
          Help &amp; tutorials
        </button>
        <div className="flex items-center gap-2.5 rounded-xl bg-panel p-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white" aria-hidden>{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-ink">{name}</p>
            <span className="mt-0.5 inline-flex rounded-full border border-accent/25 bg-accent-tint px-2 text-[12px] font-medium capitalize text-accent">{role.toLowerCase()}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
