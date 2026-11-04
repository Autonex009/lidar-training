import type { ReactNode } from "react";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">LiDAR Training Portal</p>
        <h1 className="mb-4 text-lg font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
