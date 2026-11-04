import Link from "next/link";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/trainees", label: "Trainees" },
  { href: "/admin/programs", label: "Programs" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/assets", label: "Assets" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN", "REVIEWER"]);
  return (
    <div>
      {user.role === "ADMIN" ? (
        <nav aria-label="Admin" className="mb-5 flex flex-wrap gap-4 border-b border-line pb-2 text-[13px]">
          {TABS.map((t) => <Link key={t.href} href={t.href} className="text-muted hover:text-ink">{t.label}</Link>)}
        </nav>
      ) : null}
      {children}
    </div>
  );
}
