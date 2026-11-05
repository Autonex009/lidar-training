import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getGateStateForUser, LOCK_REASON } from "@/lib/gate";
import { pendingReviewCount } from "@/lib/review/service";
import { getLearningProgressPercent } from "@/lib/progress";
import { Sidebar, type NavItem } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourOverlay } from "@/components/tour/TourOverlay";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [gate, progress, unread] = await Promise.all([
    getGateStateForUser(user.id, user.role),
    getLearningProgressPercent(user.id),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const pending = user.role === "TRAINEE" ? 0 : await pendingReviewCount();

  const items: NavItem[] = [
    { href: "/learn", label: "Learn", icon: "learn", locked: false },
    { href: "/annotate", label: "Annotate", icon: "annotate", locked: !gate.unlocked.annotate, lockReason: LOCK_REASON },
    { href: "/review", label: "Review", icon: "review", locked: !gate.unlocked.review, lockReason: LOCK_REASON, badge: pending || undefined },
    { href: "/complete", label: "Complete", icon: "complete", locked: !gate.unlocked.complete, lockReason: LOCK_REASON },
  ];
  if (user.role === "ADMIN") items.push({ href: "/admin", label: "Admin", icon: "admin", locked: false });

  return (
    <TourProvider role={user.role}>
      <div className="min-h-screen">
        <Sidebar items={items} />
        <div className="pl-[250px]">
          <Topbar name={user.name} email={user.email} role={user.role} progress={progress} unread={unread} />
          <main className="p-6">{children}</main>
        </div>
      </div>
      <TourOverlay />
    </TourProvider>
  );
}
