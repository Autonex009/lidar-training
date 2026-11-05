"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { UIcon } from "@/components/ui/Icons";
import type { Checkpoint } from "./types";

const TICK = <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>;

/** Done / not-done tick. With `n` or `icon` it becomes a 28px stepper marker (done = primary filled, current = primary ring). */
export function Check({ on, n, current = false, icon }: { on: boolean; n?: number; current?: boolean; icon?: "quiz" }) {
  if (n === undefined && !icon) {
    return (
      <span
        aria-label={on ? "Done" : "Not done"}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-success bg-success text-white" : "border-line bg-surface"}`}
      >
        {on ? TICK : null}
      </span>
    );
  }
  const cls = on ? "border-accent bg-accent text-white" : current ? "border-accent bg-surface text-accent" : "border-line bg-surface text-muted";
  return (
    <span aria-label={on ? "Done" : "Not done"} className={`relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold ${cls}`}>
      {on ? <UIcon name="check" size={14} /> : icon ? <UIcon name="quiz" size={14} /> : n}
    </span>
  );
}

export function Keycap({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex font-sans h-7 min-w-7 items-center justify-center rounded-md border border-line border-b-2 bg-surface px-2 text-[12px] font-medium">{children}</kbd>;
}

export function Checklist({ checkpoints, done }: { checkpoints: Checkpoint[]; done: ReadonlySet<string> }) {
  return (
    <ul className="space-y-1.5 text-[13px]">
      {checkpoints.map((c) => (
        <li key={c.key} data-testid={`checkpoint-${c.key}`} data-done={done.has(c.key) ? "true" : "false"} className="flex items-start gap-2"><span className="mt-0.5"><Check on={done.has(c.key)} /></span><span className={done.has(c.key) ? "text-muted" : ""}>{c.label}</span></li>
      ))}
    </ul>
  );
}

/** Small bottom-centred step dialog (title, one-line instruction, keycaps, Back/Next, progress dots). */
export function StepDialog({
  title, text, keys, complete, step, count, onStep,
}: { title: string; text: string; keys?: ReactNode; complete: boolean; step: number; count: number; onStep: (i: number) => void }) {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 w-[min(420px,92%)] -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-ink">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {complete ? <Check on /> : null}
      </div>
      <p className="mt-1 text-[12.5px] text-muted">{text}</p>
      {keys ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{keys}</div> : null}
      <div className="mt-3 flex items-center justify-between">
        <Button disabled={step === 0} onClick={() => onStep(step - 1)}>Back</Button>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full ${i === step ? "w-5 bg-ink" : "w-1.5 bg-line"}`} />
          ))}
        </div>
        <Button variant={complete ? "primary" : "secondary"} disabled={step === count - 1} onClick={() => onStep(step + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** One-line result under a prompt: tone drives the colour. */
export function Feedback({ tone, children, testId = "feedback" }: { tone: "good" | "bad" | "hint" | "info"; children: ReactNode; testId?: string }) {
  const cls = tone === "good" ? "border-success bg-success/10" : tone === "bad" ? "border-danger bg-danger/10" : tone === "hint" ? "border-warning bg-warning/10" : "border-line bg-panel";
  return <div role="status" data-testid={testId} data-tone={tone} className={`rounded-lg border-l-4 px-3 py-2 text-[13px] ${cls}`}>{children}</div>;
}
