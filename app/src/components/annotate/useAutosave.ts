"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnnotationDocument } from "@/lib/annotation/types";

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

export const DEBOUNCE_MS = 3000;
export const MAX_WAIT_MS = 10000;

/** Debounced (3 s after the last change) autosave with a 10 s max wait; POSTs the document as a draft. */
export function useAutosave(opts: { assignmentId: string; doc: AnnotationDocument; enabled: boolean; savedAt: string | null }) {
  const { assignmentId, doc, enabled } = opts;
  const docRef = useRef(doc);
  docRef.current = doc;
  const savedDoc = useRef(doc);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<string | null>(opts.savedAt);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirty = useRef<number | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const fatal = useRef(false);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);

  const schedule = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveRef.current(), delay);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inflight.current) { await inflight.current; }
    const snapshot = docRef.current;
    if (snapshot === savedDoc.current) { setStatus("saved"); return true; }
    if (fatal.current) return false;
    setStatus("saving");
    const p = (async () => {
      try {
        const res = await fetch(`/api/assignments/${assignmentId}/draft`, {
          method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ data: snapshot }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 409 || res.status === 403 || res.status === 404) fatal.current = true;
          throw new Error(j.error ?? `Save failed (${res.status})`);
        }
        const j = (await res.json()) as { savedAt: string };
        savedDoc.current = snapshot;
        setSavedAt(j.savedAt);
        setError(null);
        firstDirty.current = null;
        if (docRef.current !== snapshot) { setStatus("dirty"); firstDirty.current = Date.now(); schedule(DEBOUNCE_MS); } else setStatus("saved");
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        setStatus("error");
        if (!fatal.current) schedule(MAX_WAIT_MS);
        return false;
      } finally { inflight.current = null; }
    })();
    inflight.current = p;
    return p;
  }, [assignmentId, enabled, schedule]);
  saveRef.current = save;

  useEffect(() => {
    if (!enabled) return;
    if (doc === savedDoc.current) return;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    const now = Date.now();
    if (firstDirty.current === null) firstDirty.current = now;
    schedule(Math.max(0, Math.min(DEBOUNCE_MS, firstDirty.current + MAX_WAIT_MS - now)));
  }, [doc, enabled, schedule]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (docRef.current !== savedDoc.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const retry = useCallback(() => { fatal.current = false; void save(); }, [save]);
  return { status, savedAt, error, save, retry };
}
