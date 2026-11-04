"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

export interface NavItem {
  href: string;
  label: string;
  icon: "learn" | "annotate" | "review" | "complete" | "admin";
  locked: boolean;
  lockReason?: string;
  /** Small count shown next to the label (e.g. pending reviews for staff). */
  badge?: number;
}

const ICONS: Record<NavItem["icon"], ReactNode> = {
  learn: <path d="M3 5.5 12 3l9 2.5v13L12 21l-9-2.5v-13ZM12 3v18" />,
  annotate: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" />,
  review: <path d="M4 5h16v11H9l-5 4V5ZM8 9h8M8 12h5" />,
  complete: <path d="m5 12 4.5 4.5L19 7" />,
  admin: <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />,
};

function Icon({ name }: { name: NavItem["icon"] }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

function Lock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Locked">
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[250px] flex-col border-r border-line bg-surface">
      <div className="flex h-12 items-center border-b border-line px-4 text-sm font-semibold">LiDAR Training</div>
      <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
        {items.map((item) => {
          const base = "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px]";
          if (item.locked) {
            return (
              <Tooltip key={item.href} text={item.lockReason ?? "Locked"}>
                <span aria-disabled="true" className={`${base} cursor-not-allowed text-muted/70`}>
                  <Icon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  <Lock />
                </span>
              </Tooltip>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${base} ${active ? "bg-accent-tint font-medium text-ink" : "text-ink hover:bg-panel"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span data-testid={`nav-badge-${item.label}`} className="rounded-full bg-ink px-1.5 text-[10px] leading-4 text-surface">{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
