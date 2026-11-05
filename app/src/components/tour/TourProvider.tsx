"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { emitTourEvent, onTourEvent } from "@/lib/tour/events";
import { getInputDevice, type InputDevice } from "@/lib/tour/inputDevice";
import { canAdvance, closedState, collectTimers, filterSteps, persistPayload, pickAutoStart, tourReducer, type PersistPayload, type TourState } from "./machine";
import { TOURS } from "./registry";
import type { TourContext, TourDefinition, TourStatus } from "./types";

export interface StartOptions { force?: boolean; context?: TourContext; onComplete?: () => void }
interface SavedStatus { status: TourStatus; lastStepIndex: number }

interface PageReg { id: number; keys: string[]; ctx: TourContext; onComplete?: Record<string, () => void> }

export interface TourApi {
  state: TourState;
  def: TourDefinition | null;
  device: InputDevice;
  chosen: Record<string, string>;
  statuses: Record<string, SavedStatus>;
  role: string;
  pageKeys: string[];
  startTour: (key: string, opts?: StartOptions) => void;
  emitTourEvent: typeof emitTourEvent;
  completeStep: () => void;
  skipTour: () => void;
  resumeIfPending: () => void;
  dispatch: (a: Parameters<typeof tourReducer>[1]) => void;
  registerPage: (keys: string[], ctx: TourContext, onComplete?: Record<string, () => void>) => () => void;
  /** Tours to list in the Help menu for the current page and role. */
  helpTours: () => TourDefinition[];
}

const Ctx = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTour must be used inside TourProvider");
  return c;
}
/** Same as useTour but returns null outside a provider (e.g. isolated tests, auth pages). */
export function useTourOptional(): TourApi | null { return useContext(Ctx); }

async function post(key: string, p: PersistPayload, keepalive = false) {
  try {
    await fetch(`/api/tours/${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(p), keepalive });
  } catch { /* progress is best effort */ }
}

export function TourProvider({ role, children }: { role: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(tourReducer, closedState);
  const [statuses, setStatuses] = useState<Record<string, SavedStatus>>({});
  const [loaded, setLoaded] = useState(false);
  const [device, setDevice] = useState<InputDevice>("mouse");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<PageReg[]>([]);
  const nextPageId = useRef(1);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const callbacks = useRef<Record<string, () => void>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  // initial statuses
  useEffect(() => {
    let off = false;
    setDevice(getInputDevice());
    fetch("/api/tours", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { tours: [] }))
      .then((j: { tours: { tourKey: string; status: TourStatus; lastStepIndex: number }[] }) => {
        if (off) return;
        setStatuses(Object.fromEntries(j.tours.map((t) => [t.tourKey, { status: t.status, lastStepIndex: t.lastStepIndex }])));
      })
      .catch(() => undefined)
      .finally(() => { if (!off) setLoaded(true); });
    return () => { off = true; };
  }, []);

  // event bus -> state machine
  useEffect(() => onTourEvent((evt) => {
    if (evt.name === "tour:choice") {
      setDevice(getInputDevice());
      const s = stateRef.current;
      const step = s.steps[s.index];
      if (step && typeof evt.detail === "string") setChosen((c) => ({ ...c, [step.key]: evt.detail as string }));
    }
    dispatch({ type: "event", evt });
  }), []);

  const roleOk = useCallback((d: TourDefinition) => !d.roles || d.roles.includes(role as "TRAINEE"), [role]);
  const pageKeys = useMemo(() => (pages.length ? pages[pages.length - 1].keys : []), [pages]);
  const pageCtx = useCallback(() => (pagesRef.current.length ? pagesRef.current[pagesRef.current.length - 1].ctx : {}), []);

  const startTour = useCallback((key: string, opts: StartOptions = {}) => {
    const def = TOURS[key];
    if (!def || !roleOk(def)) return;
    const saved = statuses[key];
    if (!opts.force && saved && (saved.status === "COMPLETED" || saved.status === "SKIPPED")) return;
    const steps = filterSteps(def, opts.context ?? pageCtx());
    if (!steps.length) return;
    if (opts.onComplete) callbacks.current[key] = opts.onComplete; else delete callbacks.current[key];
    if (!opts.force && saved?.status === "IN_PROGRESS") dispatch({ type: "start", key, steps, startAt: saved.lastStepIndex, phase: "resume-pill" });
    else dispatch({ type: "start", key, steps, phase: "intro" });
  }, [statuses, roleOk, pageCtx]);

  const registerPage = useCallback((keys: string[], ctx: TourContext, onComplete?: Record<string, () => void>) => {
    const id = nextPageId.current++;
    setPages((p) => [...p, { id, keys, ctx, onComplete }]);
    return () => setPages((p) => p.filter((x) => x.id !== id));
  }, []);

  // auto-start on the current page (first NOT_STARTED tour in order; IN_PROGRESS -> resume pill)
  useEffect(() => {
    if (!loaded || state.phase !== "closed" || pages.length === 0) return;
    const page = pages[pages.length - 1];
    const keys = page.keys.filter((k) => TOURS[k] && roleOk(TOURS[k]) && filterSteps(TOURS[k], page.ctx).length > 0);
    const pick = pickAutoStart(keys, statuses);
    if (!pick) return;
    const cb = page.onComplete?.[pick.key];
    const t = setTimeout(() => startTour(pick.key, { context: page.ctx, onComplete: cb }), 400);
    return () => clearTimeout(t);
  }, [loaded, state.phase, state.key, pages, statuses, roleOk, startTour]);

  // a page-scoped tour is closed when its page goes away (progress stays saved as IN_PROGRESS)
  useEffect(() => {
    if (!loaded || state.phase === "closed" || !state.key) return;
    if (TOURS[state.key]?.scope === "page" && !pageKeys.includes(state.key)) dispatch({ type: "close" });
  }, [loaded, state.phase, state.key, pageKeys]);

  // persistence (debounced 500 ms while stepping, immediate on finish / skip)
  const lastSent = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ key: string; p: PersistPayload } | null>(null);
  useEffect(() => {
    const p = persistPayload(state);
    if (!p || !state.key) return;
    const sig = `${state.key}:${p.status}:${p.lastStepIndex}`;
    if (sig === lastSent.current) return;
    lastSent.current = sig;
    const key = state.key;
    setStatuses((s) => (s[key]?.status === p.status && s[key]?.lastStepIndex === p.lastStepIndex ? s : { ...s, [key]: p }));
    if (timer.current) clearTimeout(timer.current);
    if (p.status === "IN_PROGRESS") {
      pending.current = { key, p };
      timer.current = setTimeout(() => { const q = pending.current; pending.current = null; if (q) void post(q.key, q.p); }, 500);
    } else {
      // a step change still waiting for its debounce is sent first, so the server sees IN_PROGRESS before COMPLETED / SKIPPED
      const q = pending.current;
      pending.current = null;
      void (async () => { if (q) await post(q.key, q.p); await post(key, p); })();
      if (p.status === "COMPLETED") { const cb = callbacks.current[key]; delete callbacks.current[key]; cb?.(); }
    }
  }, [state]);

  useEffect(() => {
    const flush = () => { const q = pending.current; if (q) { pending.current = null; void post(q.key, q.p, true); } };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, []);

  // step onEnter + timers
  useEffect(() => {
    if (state.phase !== "step") return;
    const step = state.steps[state.index];
    if (!step) return;
    step.onEnter?.();
    const ms = collectTimers(step.complete);
    const timers = ms.map((m) => setTimeout(() => emitTourEvent("tour:timer"), m));
    return () => timers.forEach(clearTimeout);
  }, [state.phase, state.index, state.key, state.steps]);

  const api = useMemo<TourApi>(() => ({
    state,
    def: state.key ? TOURS[state.key] ?? null : null,
    device, chosen, statuses, role, pageKeys, startTour, emitTourEvent, dispatch,
    completeStep: () => { if (canAdvance(stateRef.current)) dispatch({ type: "next" }); },
    skipTour: () => dispatch({ type: "skip-confirm" }),
    resumeIfPending: () => dispatch({ type: "resume" }),
    registerPage,
    helpTours: () => Object.values(TOURS).filter((d) => roleOk(d) && (d.scope === "global" || pageKeys.includes(d.key))),
  }), [state, device, chosen, statuses, role, pageKeys, startTour, registerPage, roleOk]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
