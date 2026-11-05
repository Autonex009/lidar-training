"use client";

import { useEffect, useRef } from "react";
import { useTourOptional } from "./TourProvider";
import type { TourContext } from "./types";

/**
 * Declares which tours are relevant on the current page (in priority order) so the provider can
 * auto-start the first one that has not been done, list them in the Help menu, and give them context.
 */
export function usePageTours(keys: string[], ctx: TourContext = {}, onComplete?: Record<string, () => void>) {
  const tour = useTourOptional();
  const register = tour?.registerPage;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;
  const sig = keys.join("|") + "#" + JSON.stringify(ctx);
  useEffect(() => {
    if (!register) return;
    const wrapped = Object.fromEntries(keys.map((k) => [k, () => cbRef.current?.[k]?.()]));
    return register(keys, ctxRef.current, wrapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, sig]);
}

/** Render-less component form for server-rendered pages. */
export function PageTours({ keys, ctx }: { keys: string[]; ctx?: TourContext }) {
  usePageTours(keys, ctx);
  return null;
}
