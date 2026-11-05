/**
 * Pure tour state machine (no React, no DOM): step completion rules, navigation, resume and the
 * payloads that get persisted. TourProvider drives it with useReducer.
 */
import type { Completion, TourContext, TourDefinition, TourStatus, TourStep } from "./types";

// ---------- completion rules ----------

export interface Leaf { count: number; seen: string[]; done: boolean }
export type Progress = Record<string, Leaf>;
export interface Evt { name: string; detail?: unknown }

const detailOf = (e: Evt): string | null => (typeof e.detail === "string" ? e.detail : null);

function leafMatches(c: Completion, e: Evt): boolean {
  switch (c.kind) {
    case "control": return e.name === `control:${c.control}`;
    case "event": return e.name === c.event;
    case "click-target": return e.name === "tour:target-click";
    case "choice": return e.name === "tour:choice";
    case "timer": return e.name === "tour:timer";
    default: return false;
  }
}

function leafDone(c: Completion, l: Leaf): boolean {
  if (c.kind === "control" || c.kind === "event") {
    const need = c.needs ?? [];
    return l.count >= (c.count ?? 1) && need.every((n) => l.seen.includes(n));
  }
  return l.done;
}

export function feed(c: Completion, p: Progress, e: Evt, path = "0"): Progress {
  if (c.kind === "all") {
    let next = p;
    c.of.forEach((child, i) => { next = feed(child, next, e, `${path}.${i}`); });
    return next;
  }
  if (c.kind === "manual" || !leafMatches(c, e)) return p;
  const cur = p[path] ?? { count: 0, seen: [], done: false };
  const d = detailOf(e);
  const seen = d && !cur.seen.includes(d) ? [...cur.seen, d] : cur.seen;
  const next: Leaf = { count: cur.count + 1, seen, done: true };
  return { ...p, [path]: { ...next, done: leafDone(c, { ...next, done: true }) } };
}

export function isDone(c: Completion, p: Progress, path = "0"): boolean {
  if (c.kind === "manual") return true;
  if (c.kind === "all") return c.of.every((child, i) => isDone(child, p, `${path}.${i}`));
  const l = p[path];
  return !!l && leafDone(c, l);
}

/** Informational steps get no check mark. */
export const isInformational = (c: Completion): boolean => c.kind === "manual" || (c.kind === "all" && c.of.every(isInformational));

export function collectTimers(c: Completion, out: number[] = []): number[] {
  if (c.kind === "timer") out.push(c.ms);
  else if (c.kind === "all") c.of.forEach((x) => collectTimers(x, out));
  return out;
}

// ---------- tour state ----------

export type Phase = "closed" | "intro" | "step" | "confirm-skip" | "resume-pill";

export interface TourState {
  key: string | null;
  steps: TourStep[];
  phase: Phase;
  index: number;
  done: boolean[];
  progress: Progress[];
  /** Phase to return to when a skip prompt is cancelled. */
  prev: "intro" | "step";
  /** Set when the run ended: how. */
  outcome: null | "COMPLETED" | "SKIPPED";
}

export const closedState: TourState = { key: null, steps: [], phase: "closed", index: 0, done: [], progress: [], prev: "step", outcome: null };

export type TourAction =
  | { type: "start"; key: string; steps: TourStep[]; startAt?: number; phase?: "intro" | "step" | "resume-pill" }
  | { type: "begin" }
  | { type: "resume" }
  | { type: "event"; evt: Evt }
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; index: number }
  | { type: "skip-request" }
  | { type: "skip-cancel" }
  | { type: "skip-confirm" }
  | { type: "close" };

export function filterSteps(def: TourDefinition, ctx: TourContext): TourStep[] {
  return def.steps.filter((s) => !s.when || s.when(ctx));
}

function initDone(steps: TourStep[]): boolean[] {
  return steps.map((s) => isDone(s.complete, {}));
}

export function stepDone(state: TourState, i = state.index): boolean {
  return state.done[i] ?? false;
}

/** Whether the Next button is enabled on the current step. */
export function canAdvance(state: TourState): boolean {
  if (state.phase !== "step") return false;
  const s = state.steps[state.index];
  return !!s && (stepDone(state) || !!s.allowSkip);
}

export function tourReducer(s: TourState, a: TourAction): TourState {
  switch (a.type) {
    case "start": {
      const n = a.steps.length;
      const index = Math.max(0, Math.min(n - 1, a.startAt ?? 0));
      return { key: a.key, steps: a.steps, phase: a.phase ?? "intro", index, done: initDone(a.steps), progress: a.steps.map(() => ({})), prev: "intro", outcome: null };
    }
    case "begin": return s.phase === "intro" ? { ...s, phase: "step", index: 0 } : s;
    case "resume": return s.phase === "resume-pill" ? { ...s, phase: "step" } : s;
    case "event": {
      if (s.phase !== "step") return s;
      const step = s.steps[s.index];
      if (!step || s.done[s.index]) return s;
      const progress = feed(step.complete, s.progress[s.index], a.evt);
      if (progress === s.progress[s.index]) return s;
      const nextProgress = s.progress.slice(); nextProgress[s.index] = progress;
      const done = s.done.slice(); done[s.index] = isDone(step.complete, progress);
      return { ...s, progress: nextProgress, done };
    }
    case "next": {
      if (!canAdvance(s)) return s;
      if (s.index >= s.steps.length - 1) return { ...s, phase: "closed", outcome: "COMPLETED" };
      return { ...s, index: s.index + 1 };
    }
    case "back": return s.phase === "step" && s.index > 0 ? { ...s, index: s.index - 1 } : s;
    case "goto": return s.phase === "step" ? { ...s, index: Math.max(0, Math.min(s.steps.length - 1, a.index)) } : s;
    case "skip-request": return s.phase === "step" || s.phase === "intro" ? { ...s, phase: "confirm-skip", prev: s.phase } : s;
    case "skip-cancel": return s.phase === "confirm-skip" ? { ...s, phase: s.prev } : s;
    case "skip-confirm": return s.phase === "confirm-skip" || s.phase === "resume-pill" ? { ...s, phase: "closed", outcome: "SKIPPED" } : s;
    case "close": return { ...closedState };
  }
}

// ---------- persistence ----------

export interface PersistPayload { status: TourStatus; lastStepIndex: number }

/** What to write to the server for the current state (null = nothing to persist). */
export function persistPayload(s: TourState): PersistPayload | null {
  if (!s.key) return null;
  if (s.outcome === "COMPLETED") return { status: "COMPLETED", lastStepIndex: Math.max(0, s.steps.length - 1) };
  if (s.outcome === "SKIPPED") return { status: "SKIPPED", lastStepIndex: s.index };
  if (s.phase === "step" || s.phase === "resume-pill" || (s.phase === "confirm-skip" && s.prev === "step")) return { status: "IN_PROGRESS", lastStepIndex: s.index };
  return null;
}

// ---------- auto-start ----------

/** Which tour (if any) to auto-start on a page, given the page's ordered tour keys and the saved statuses. */
export function pickAutoStart(keys: string[], statuses: Record<string, { status: TourStatus; lastStepIndex: number }>):
  { key: string; mode: "intro" | "resume" } | null {
  for (const key of keys) {
    const st = statuses[key]?.status ?? "NOT_STARTED";
    if (st === "COMPLETED" || st === "SKIPPED") continue;
    return { key, mode: st === "IN_PROGRESS" ? "resume" : "intro" };
  }
  return null;
}
