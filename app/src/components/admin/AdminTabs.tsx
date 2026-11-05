"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/trainees", label: "Trainees" },
  { href: "/admin/programs", label: "Programs" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/assets", label: "Assets" },
  { href: "/admin/users", label: "Users" },
];

/** Pill tab bar for the admin area. */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-[14px] font-medium ${active ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:bg-panel"}`}>{t.label}</Link>
        );
      })}
    </nav>
  );
}
