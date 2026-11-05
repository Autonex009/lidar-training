import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { Ring } from "@/components/ui/Ring";
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-4 border-b border-line bg-surface px-6">
      <div className="flex items-center gap-2 text-[13px] text-muted" title={`Learning progress ${progress}%`} data-tour="topbar-progress">
        <span>Learning</span>
        <Ring value={progress} size={28} label={`Learning progress ${progress}%`} />
      </div>
      <NotificationsBell initialUnread={unread} />
      <HelpMenu />
      <ProfileMenu name={name} email={email} role={role} />
    </header>
  );
}
