"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function ProfileMenu({ name, email, role }: { name: string; email: string; role: string }) {
  const [open, setOpen] = useState(false);

  async function logout() {
    try {
      await fetch("/api/auth/logout-event", { method: "POST" });
    } catch {
      // logging must not block sign-out
    }
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full border border-line py-0 pl-1.5 pr-3.5 text-[13px] hover:bg-panel"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white text-[12px] font-semibold">
          {name.charAt(0).toUpperCase()}
        </span>
        {name}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-40 w-56 rounded-xl border border-line bg-surface p-1 text-[13px] shadow-float">
          <div className="border-b border-line px-2 py-1.5">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-xs text-muted">{email} · {role}</p>
          </div>
          <button role="menuitem" type="button" onClick={logout} className="mt-1 w-full rounded px-2 py-1.5 text-left hover:bg-panel">
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
