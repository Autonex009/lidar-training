"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { Checkpoint } from "./types";

export function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-label={on ? "Done" : "Not done"}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-success bg-success text-white" : "border-line bg-surface"}`}
    >
      {on ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
      ) : null}
    </span>
  );
}

export function Keycap({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex font-sans h-7 min-w-7 items-center justify-center rounded-md border border-line border-b-2 bg-surface px-2 text-[12px] font-medium">{children}</kbd>;
}

export function Checklist({ checkpoints, done }: { checkpoints: Checkpoint[]; done: ReadonlySet<string> }) {
  return (
    <ul className="mt-2 space-y-1 text-[13px]">
      {checkpoints.map((c) => (
        <li key={c.key} className="flex items-center gap-2"><Check on={done.has(c.key)} /><span className={done.has(c.key) ? "text-muted" : ""}>{c.label}</span></li>
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
