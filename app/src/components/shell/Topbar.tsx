import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { HelpMenu } from "@/components/tour/HelpMenu";

export function Topbar({
  name,
  email,
  role,
  progress,
  unread,
}: {
  name: string;
  email: string;
  role: string;
  progress: number;
  unread: number;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-end gap-4 border-b border-line bg-surface px-4">
      <div className="flex items-center gap-2 text-[13px] text-muted" title="Learning progress" data-tour="topbar-progress">
        <span>Learning</span>
        <div className="h-1.5 w-28 overflow-hidden rounded bg-panel border border-line">
          <div className="h-full grad-bar" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-8 text-ink">{progress}%</span>
      </div>
      <NotificationsBell initialUnread={unread} />
      <HelpMenu />
      <ProfileMenu name={name} email={email} role={role} />
    </header>
  );
}
