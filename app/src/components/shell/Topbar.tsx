import { ProfileMenu } from "@/components/shell/ProfileMenu";

function Bell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7ZM10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

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
      <div className="flex items-center gap-2 text-[13px] text-muted" title="Learning progress">
        <span>Learning</span>
        <div className="h-1.5 w-28 overflow-hidden rounded bg-panel border border-line">
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-8 text-ink">{progress}%</span>
      </div>
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-line hover:bg-panel"
        aria-label={`Notifications (${unread} unread)`}
      >
        <Bell />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] text-surface">
            {unread}
          </span>
        ) : null}
      </button>
      <ProfileMenu name={name} email={email} role={role} />
    </header>
  );
}
