"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { Issue } from "@/lib/annotation/validate";
import type { Feedback } from "@/lib/tasks/service";
import type { WorkspaceTask } from "@/lib/tasks/runtime";

export function InstructionsDrawer({ open, onClose, task, feedback, tagNames, onHint }: {
  open: boolean; onClose: () => void; task: WorkspaceTask; feedback: Feedback | null; tagNames: Record<string, string>; onHint: (index: number) => void;
}) {
  const [revealed, setRevealed] = useState(0);
  if (!open) return null;
  const sec = "mb-3";
  const h = "mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted";
  return (
    <aside role="complementary" aria-label="Annotation instructions" className="absolute bottom-0 right-0 top-0 z-30 flex w-[380px] flex-col border-l border-line bg-surface" data-testid="instructions-drawer">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-[13px] font-semibold">{task.code} · Instructions</span>
        <button type="button" className="text-[12px] underline" onClick={onClose}>Close</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-[13px]">
        {feedback && feedback.decision === "REQUEST_REVISION" && (
          <div className={`${sec} rounded border border-danger/30 bg-danger/10 p-2`}>
            <div className={h}>Previous feedback</div>
            <p>{feedback.feedback || "Revision requested."}</p>
            {feedback.errorTags.length > 0 && <p className="mt-1 text-[12px]">Tags: {feedback.errorTags.map((t) => tagNames[t] ?? t).join(", ")}</p>}
            {feedback.correctionInstructions && <p className="mt-1 text-[12px]">Correction: {feedback.correctionInstructions}</p>}
          </div>
        )}
        <div className={sec}><div className={h}>Description</div><p>{task.description}</p></div>
        <div className={sec}><div className={h}>Objective</div><p>{task.objective}</p></div>
        <div className={sec}><div className={h}>Instructions</div><ol className="list-none space-y-1">{task.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
        <div className={sec}><div className={h}>Required output</div><ul className="list-disc pl-4">{task.requiredOutput.map((s, i) => <li key={i}>{s}</li>)}</ul><p className="mt-1 text-muted">{task.expectedOutput}</p></div>
        <div className={sec}>
          <div className={h}>Hints ({revealed}/{task.hints.length})</div>
          <ol className="list-decimal space-y-1 pl-4">{task.hints.slice(0, revealed).map((s, i) => <li key={i}>{s}</li>)}</ol>
          {revealed < task.hints.length && (
            <Button className="mt-1" onClick={() => { onHint(revealed); setRevealed(revealed + 1); }}>Reveal hint {revealed + 1}</Button>
          )}
        </div>
      </div>
    </aside>
  );
}

const KEYS: [string, string][] = [
  ["V / C / M", "Select / Create / Move tool"],
  ["Hold R + drag", "Rotate selected box (Shift snaps 15°)"],
  ["B / L", "Brush / Lasso (segmentation)"],
  ["F", "Flag tool (click to place a flag)"],
  ["1 - 9", "Pick label (and relabel selected box)"],
  ["Arrows / PgUp / PgDn", "Nudge centre 5 cm (Ctrl = 50 cm)"],
  ["Shift + arrows / PgUp / PgDn", "Resize length, width, height"],
  ["Q / E", "Rotate yaw by 2° (Ctrl = 20°)"],
  ["Alt + drag (Move)", "Move vertically"],
  ["G", "Fit selected box to points"],
  ["Del / Backspace", "Delete selected box"],
  ["Ctrl + D", "Duplicate selected box"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Undo / Redo"],
  ["Ctrl + S", "Save draft"],
  [", / .", "Previous / next frame"],
  ["Esc", "Deselect, back to Select tool"],
  ["?", "This help"],
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <table className="w-full text-[12px]"><tbody>
        {KEYS.map(([k, d]) => <tr key={k}><td className="border-b border-line py-1 pr-3 font-mono">{k}</td><td className="border-b border-line py-1">{d}</td></tr>)}
      </tbody></table>
      <div className="mt-3 flex justify-end"><Button onClick={onClose}>Close</Button></div>
    </Dialog>
  );
}

export function SubmitDialog({ open, onClose, errors, warnings, busy, serverError, onConfirm }: {
  open: boolean; onClose: () => void; errors: Issue[]; warnings: Issue[]; busy: boolean; serverError: string | null; onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? () => undefined : onClose} title="Submit for review">
      <div className="max-h-[60vh] space-y-2 overflow-y-auto text-[13px]" data-testid="submit-dialog">
        {errors.length === 0 && warnings.length === 0 && <p>Everything looks complete. Your work will be locked while a reviewer checks it.</p>}
        {errors.length > 0 && (
          <div><p className="font-medium text-danger-ink">Fix these before submitting ({errors.length})</p>
            <ul className="list-disc pl-4">{errors.slice(0, 30).map((e, i) => <li key={i}>{e.message}</li>)}{errors.length > 30 && <li>and {errors.length - 30} more</li>}</ul></div>
        )}
        {warnings.length > 0 && (
          <div><p className="font-medium text-warning-ink">Warnings ({warnings.length}), you can still submit</p>
            <ul className="list-disc pl-4">{warnings.slice(0, 20).map((e, i) => <li key={i}>{e.message}</li>)}</ul></div>
        )}
        {serverError && <p className="text-danger-ink">{serverError}</p>}
        {errors.length === 0 && <p className="text-muted">Submitting locks the task until the reviewer responds. A submitted version cannot be edited.</p>}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onClose} disabled={busy}>Back to editing</Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy || errors.length > 0}>{busy ? "Submitting..." : "Confirm and submit"}</Button>
      </div>
    </Dialog>
  );
}
