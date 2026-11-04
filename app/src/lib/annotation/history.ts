import type { AnnotationDocument } from "./types";

/** Snapshot-based undo/redo. Documents are treated as immutable values (reducers always copy). */
export interface History {
  past: AnnotationDocument[];
  present: AnnotationDocument;
  future: AnnotationDocument[];
}

const LIMIT = 200;

export const createHistory = (doc: AnnotationDocument): History => ({ past: [], present: doc, future: [] });

/** Push a new present. Returns the same history when nothing changed (reference equality). */
export function commit(h: History, next: AnnotationDocument): History {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > LIMIT) past.shift();
  return { past, present: next, future: [] };
}

/** Replace the present without recording an undo step (e.g. live drag preview, remote reload). */
export function replacePresent(h: History, next: AnnotationDocument): History {
  return { ...h, present: next };
}

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

export function undo(h: History): History {
  if (!h.past.length) return h;
  const prev = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest };
}

/**
 * Drag support: `begin` remembers the pre-drag document; live updates use replacePresent; `end`
 * commits one undo step from the remembered document.
 */
export function endGesture(h: History, before: AnnotationDocument): History {
  if (before === h.present) return h;
  const past = [...h.past, before];
  if (past.length > LIMIT) past.shift();
  return { past, present: h.present, future: [] };
}
