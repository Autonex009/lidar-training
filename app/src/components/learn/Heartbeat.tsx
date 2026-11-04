"use client";

import { useEffect } from "react";

/** Pings /api/learn/heartbeat every 30s while the tab is visible. */
export function Heartbeat({ moduleId }: { moduleId?: string }) {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/learn/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: moduleId ?? null }),
        credentials: "same-origin",
      }).catch(() => undefined);
    };
    ping();
    const t = setInterval(ping, 30_000);
    return () => clearInterval(t);
  }, [moduleId]);
  return null;
}
