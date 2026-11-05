"use client";

import { Fragment, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Check } from "@/components/learn/widgets/Parts";
import { emitTourEvent } from "@/lib/tour/events";
import { KeycapRow } from "./Keycaps";
import { canAdvance, isInformational } from "./machine";
import { useTour } from "./TourProvider";
import type { TourStep } from "./types";

/** `**bold**` -> <strong>. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}

const isCss = (s: string) => /[\[\]#.>:\s]/.test(s);
export function resolveTarget(selector: string): HTMLElement | null {
  try { return document.querySelector<HTMLElement>(isCss(selector) ? selector : `[data-tour="${selector}"]`); } catch { return null; }
}

function useTargetRect(step: TourStep | undefined, tick: unknown): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const sel = step?.spotlight?.selector;
    if (!sel) { setRect(null); return; }
    let raf = 0;
    const measure = () => {
      const el = resolveTarget(sel);
      const r = el ? el.getBoundingClientRect() : null;
      setRect((prev) => (r && r.width > 0 && r.height > 0 ? (prev && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r) : prev ? null : prev));
    };
    measure();
    const el = resolveTarget(sel);
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    const onChange = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    const iv = setInterval(measure, 400); // catches layout shifts, late mounts and drawers opening
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(onChange) : null;
    if (el) ro?.observe(el);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onChange); window.removeEventListener("scroll", onChange, true); clearInterval(iv); ro?.disconnect(); };
  }, [step, tick]);
  return rect;
}

function Spotlight({ rect, pad }: { rect: DOMRect; pad: number }) {
  return (
    <div
      data-testid="tour-spotlight" aria-hidden
      className="pointer-events-none fixed z-[75] rounded-lg border-2 border-accent"
      style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,.35)" }}
    />
  );
}

function CloseX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} data-testid="tour-close" onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-panel hover:text-ink">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M2 2l10 10M12 2 2 12" /></svg>
    </button>
  );
}

function IntroPreview({ kind }: { kind: "viewer" | "none" }) {
  if (kind === "none") return null;
  const dots: ReactNode[] = [];
  for (let r = 1; r <= 7; r++) for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 0.9 + 0.1 * r;
    dots.push(<circle key={`${r}-${i}`} cx={90 + Math.cos(a) * r * 22} cy={150 - Math.sin(a) * r * 16} r={1.2} fill="#8d8d8d" opacity={0.6} />);
  }
  const chip = (keys: string[], label: string) => (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {keys.map((k) => <kbd key={k} className="rounded border border-[#555] px-1 text-[10px] font-sans leading-4">{k}</kbd>)}
      <span>{label}</span>
    </span>
  );
  return (
    <div className="m-3 mb-0 overflow-hidden rounded-xl bg-panel" aria-hidden data-testid="tour-preview">
      <div className="py-1.5 pl-3 pr-12 text-right text-[11px] text-muted">3D Scene</div>
      <div className="relative h-[190px] bg-[#111]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice">{dots}</svg>
        <div className="absolute inset-x-2 top-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white">
          {chip(["W", "A", "S", "D"], "Move")}{chip(["⌘"], "Center camera")}{chip(["Q", "E"], "Elevate")}{chip(["⇧"], "Go faster")}
        </div>
      </div>
    </div>
  );
}

function Intro() {
  const { def, dispatch } = useTour();
  if (!def) return null;
  const close = () => { dispatch({ type: "skip-request" }); dispatch({ type: "skip-confirm" }); };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" data-testid="tour-backdrop">
      <div role="dialog" aria-modal="true" aria-label={def.intro.heading} data-testid="tour-intro" className="relative w-[min(560px,96vw)] overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="absolute right-3 top-3 z-10 rounded-md bg-surface/90"><CloseX onClick={close} label="Close tutorial" /></div>
        <IntroPreview kind={def.intro.previewKind ?? "none"} />
        <div className="px-8 pb-7 pt-6 text-center">
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight">{def.intro.heading}</h2>
          <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-relaxed text-muted">{def.intro.body}</p>
          <button type="button" data-testid="tour-start" autoFocus onClick={() => dispatch({ type: "begin" })}
            className="mt-5 h-11 w-full rounded-xl border border-accent bg-accent text-[15px] font-medium text-ink hover:brightness-95">
            Start tutorial · {def.intro.estimatedMinutes} {def.intro.estimatedMinutes === 1 ? "min" : "mins"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCard() {
  const tour = useTour();
  const { state, dispatch, device, chosen } = tour;
  const step = state.steps[state.index];
  const [tick, setTick] = useState(0);
  const rect = useTargetRect(step, `${state.key}:${state.index}:${tick}`);

  // click-target completion: any click on the spotlighted element counts
  useEffect(() => {
    if (!step || state.phase !== "step") return;
    if (step.complete.kind !== "click-target" && !(step.complete.kind === "all" && step.complete.of.some((c) => c.kind === "click-target"))) return;
    const sel = step.spotlight?.selector;
    if (!sel) return;
    const h = (e: Event) => { const el = resolveTarget(sel); if (el && e.target instanceof Node && el.contains(e.target)) emitTourEvent("tour:target-click"); };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [step, state.phase]);

  if (!step) return null;
  const done = state.done[state.index];
  const confirm = state.phase === "confirm-skip";
  const last = state.index === state.steps.length - 1;
  const enabled = canAdvance(state);
  const text = step.instructionBy?.[device] ?? step.instruction;
  const keys = step.keycapsBy?.[device] ?? step.keycaps;
  const pad = step.spotlight?.padding ?? 4;
  const near = step.placement === "near-target" && rect;

  let style: React.CSSProperties | undefined;
  if (near) {
    const W = 460, vw = typeof window !== "undefined" ? window.innerWidth : 1200, vh = typeof window !== "undefined" ? window.innerHeight : 800;
    if (rect.right + W + 24 < vw) style = { left: rect.right + pad + 14, top: Math.max(12, Math.min(vh - 280, rect.top)) };
    else if (rect.bottom + 280 < vh) style = { left: Math.max(12, Math.min(vw - W - 12, rect.left)), top: rect.bottom + pad + 12 };
    else style = { left: Math.max(12, Math.min(vw - W - 12, rect.left)), bottom: vh - rect.top + pad + 12 };
  }

  return (
    <>
      {rect && <Spotlight rect={rect} pad={pad} />}
      <div
        role="dialog" aria-label={step.title} data-testid="tour-dialog" data-step={step.key} data-done={done ? "true" : "false"}
        className={`fixed z-[80] w-[min(520px,94vw)] rounded-2xl border border-line p-5 text-ink ${near ? "" : "bottom-5 left-1/2 -translate-x-1/2"} ${done && !isInformational(step.complete) ? "bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]" : "bg-surface"}`}
        style={style}
      >
        {confirm ? (
          <div data-testid="tour-skip-prompt">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[18px] font-semibold">Skip this tutorial?</h3>
            </div>
            <p className="mt-1.5 text-[13px] text-muted">You can reopen it any time from the Help menu (?) in the top bar.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" data-testid="tour-skip-cancel" onClick={() => dispatch({ type: "skip-cancel" })} className="h-9 rounded-lg border border-line px-4 text-[13px] font-medium hover:bg-panel">Keep going</button>
              <button type="button" data-testid="tour-skip-confirm" onClick={() => dispatch({ type: "skip-confirm" })} className="h-9 rounded-lg border border-ink bg-ink px-4 text-[13px] font-medium text-surface">Skip tutorial</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[19px] font-semibold leading-tight" data-testid="tour-title">{step.title}</h3>
                {done && !isInformational(step.complete) ? <span data-testid="tour-check"><Check on /></span> : null}
              </div>
              <CloseX onClick={() => dispatch({ type: "skip-request" })} label="Close tutorial" />
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted" data-testid="tour-instruction">{rich(text)}</p>
            {step.choice && (
              <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Choose an option">
                {step.choice.options.map((o) => {
                  const on = chosen[step.key] === o.key;
                  return (
                    <button key={o.key} type="button" aria-pressed={on} data-testid={`tour-choice-${o.key}`}
                      onClick={() => { step.choice?.onChoose?.(o.key); emitTourEvent("tour:choice", o.key); setTick((t) => t + 1); }}
                      className={`flex h-9 items-center justify-center gap-2 rounded-lg border text-[13px] font-medium ${on ? "border-[#8aa81d] bg-[#8aa81d] text-white" : "border-line bg-panel hover:bg-line/50"}`}>
                      {o.icon === "mouse" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 3v6" /></svg>}
                      {o.icon === "trackpad" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 15h18" /></svg>}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
            {keys && keys.length > 0 && <div className="mt-3"><KeycapRow keys={keys} active={done} /></div>}
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <button type="button" data-testid="tour-back" disabled={state.index === 0} onClick={() => dispatch({ type: "back" })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3.5 text-[13px] font-medium enabled:hover:bg-line/50 disabled:opacity-50">← Back</button>
              </div>
              <div className="flex gap-1.5" aria-label={`Step ${state.index + 1} of ${state.steps.length}`} role="img">
                {state.steps.map((s, i) => <span key={s.key} className={`h-1.5 rounded-full ${i === state.index ? "w-5 bg-ink" : state.done[i] && !isInformational(s.complete) ? "w-1.5 bg-[#8aa81d]" : "w-1.5 bg-line"}`} />)}
              </div>
              <div className="flex justify-end">
                <button type="button" data-testid="tour-next" disabled={!enabled} onClick={() => dispatch({ type: "next" })}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium disabled:opacity-50 ${enabled ? "border-accent bg-accent hover:brightness-95" : "border-line bg-panel"}`}>
                  {last ? "Finish" : "Next"} {enabled ? <span aria-hidden>↵</span> : <span aria-hidden>→</span>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function TourOverlay() {
  const tour = useTour();
  const { state, dispatch, def } = tour;

  useEffect(() => {
    if (state.phase === "closed" || state.phase === "resume-pill") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        dispatch({ type: state.phase === "confirm-skip" ? "skip-cancel" : "skip-request" });
      } else if (e.key === "Enter" && !typing && !(t && t.tagName === "BUTTON" && !t.dataset.testid?.startsWith("tour-choice")) && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (state.phase === "intro") { e.preventDefault(); dispatch({ type: "begin" }); }
        else if (state.phase === "step" && canAdvance(state)) { e.preventDefault(); dispatch({ type: "next" }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, dispatch]);

  if (!def || state.phase === "closed") return null;
  if (state.phase === "resume-pill") {
    return (
      <div className="fixed bottom-4 right-4 z-[80] flex items-center overflow-hidden rounded-full border border-line bg-surface text-[13px]" data-testid="tour-resume-pill">
        <button type="button" data-testid="tour-resume" onClick={() => dispatch({ type: "resume" })} className="h-9 bg-accent px-4 font-medium hover:brightness-95">Resume tutorial</button>
        <span className="hidden px-3 text-muted sm:inline">{def.title}</span>
        <button type="button" aria-label="Dismiss tutorial" data-testid="tour-resume-dismiss" onClick={() => dispatch({ type: "skip-confirm" })} className="h-9 px-3 text-muted hover:bg-panel">×</button>
      </div>
    );
  }
  if (state.phase === "intro") return <Intro />;
  if (state.phase === "confirm-skip" && state.prev === "intro") return <Intro />;
  return <StepCard />;
}
