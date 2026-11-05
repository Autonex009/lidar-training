/**
 * Tiny client-side event bus for guided tours. Anything (reducer dispatcher, viewer, buttons) can call
 * `emitTourEvent(name, detail)`; the TourProvider listens and ticks the current step when it matches.
 * Safe to call when no tour is active (events are simply dropped).
 */
export interface TourEvent { name: string; detail?: unknown }
type Handler = (e: TourEvent) => void;

const handlers = new Set<Handler>();

export function emitTourEvent(name: string, detail?: unknown): void {
  const e: TourEvent = { name, detail };
  for (const h of [...handlers]) {
    try { h(e); } catch { /* a bad listener must not break the app */ }
  }
}

/** Subscribe to every event. Returns the unsubscribe function. */
export function onTourEvent(h: Handler): () => void {
  handlers.add(h);
  return () => { handlers.delete(h); };
}

/** Test helper. */
export function _listenerCount(): number { return handlers.size; }
