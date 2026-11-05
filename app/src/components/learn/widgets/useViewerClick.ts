"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { ViewerApi } from "@/components/viewer";
import type { FindClick } from "@/lib/learn/interactive";

/**
 * Calls `onClick` for a plain left click (no drag, no Ctrl/Cmd) on the viewer canvas with the point under the
 * cursor and the ground hit. `enabled` lets a widget ignore clicks while it is showing feedback.
 */
export function useViewerClick(api: RefObject<ViewerApi | null>, active: boolean, onClick: (c: FindClick) => void) {
  const cb = useRef(onClick);
  cb.current = onClick;
  useEffect(() => {
    if (!active) return;
    const eng = api.current?.getEngine();
    if (!eng) return;
    const c = eng.canvas;
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => { down = e.button === 0 && !e.ctrlKey && !e.metaKey ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || e.button !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || performance.now() - d.t > 700) return;
      const pick = eng.pickPoint(e.clientX, e.clientY);
      cb.current({ pick: pick?.position ?? null, ground: eng.raycastGround(e.clientX, e.clientY), groundZ: eng.groundLevel });
    };
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointerup", onUp);
    return () => { c.removeEventListener("pointerdown", onDown); c.removeEventListener("pointerup", onUp); };
  }, [api, active]);
}
