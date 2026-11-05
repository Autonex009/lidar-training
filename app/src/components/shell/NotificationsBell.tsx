"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Item { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string }

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString();
}

function Bell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7ZM10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

const post = (body: unknown) => fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { items: Item[]; unread: number };
      setItems(j.items);
      setUnread(j.unread);
      setLoaded(true);
    } catch { /* offline: keep what we have */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, load]);

  const click = async (n: Item) => {
    setOpen(false);
    if (!n.read) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      await post({ ids: [n.id] }).catch(() => undefined);
    }
    if (n.link && n.link.startsWith("/")) router.push(n.link);
  };
  const markAll = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await post({ all: true }).catch(() => undefined);
  };

  return (
    <div className="relative" ref={box} data-tour="topbar-bell">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} data-testid="notifications-button"
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-line hover:bg-panel" aria-label={`Notifications (${unread} unread)`}>
        <Bell />
        {unread > 0 ? (
          <span data-testid="notifications-unread" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] text-surface">{unread}</span>
        ) : null}
      </button>
      {open && (
        <div role="menu" data-testid="notifications-panel" className="absolute right-0 top-10 z-40 w-[360px] rounded-md border border-line bg-surface text-[13px]">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="font-medium">Notifications</span>
            <button type="button" onClick={() => void markAll()} disabled={unread === 0} className="text-[12px] text-muted hover:text-ink disabled:opacity-40">Mark all read</button>
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {items.length === 0 && <li className="px-3 py-6 text-center text-muted">{loaded ? "No notifications yet." : "Loading..."}</li>}
            {items.map((n) => (
              <li key={n.id} className="border-b border-line last:border-b-0">
                <button type="button" role="menuitem" onClick={() => void click(n)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-panel" data-testid="notification-item">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-ink"}`} aria-label={n.read ? "Read" : "Unread"} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${n.read ? "" : "font-medium"}`}>{n.title}</span>
                    {n.body ? <span className="block text-[12px] text-muted line-clamp-2">{n.body}</span> : null}
                    <span className="block text-[11px] text-muted">{relativeTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
