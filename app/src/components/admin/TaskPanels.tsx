"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { OpButton, Status, useOp } from "./client";
import { areaCls, inputCls } from "./ui";

export function TaskActions({ id, code, isPublished, assignments }: { id: string; code: string; isPublished: boolean; assignments: number }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <OpButton op="task.duplicate" input={{ id }} label="Duplicate" navigate={(d) => `/admin/tasks/${d.id}`} />
      <OpButton op="task.setPublished" input={{ id, published: !isPublished }} label={isPublished ? "Unpublish" : "Publish"} onResult={(d) => ((d as { assignmentsCreated?: number }).assignmentsCreated ? `${(d as { assignmentsCreated: number }).assignmentsCreated} assignments created.` : "Saved.")} />
      <OpButton op="task.delete" input={{ id }} label="Delete" disabled={assignments > 0} confirm={`Delete ${code}? This cannot be undone.`} navigate={() => "/admin/tasks"} />
      {assignments > 0 ? <span className="self-center text-[12px] text-muted">Delete disabled: {assignments} assignment(s).</span> : null}
    </div>
  );
}

export interface TraineeOpt { id: string; name: string; email: string; assigned: boolean }

export function AssignPanel({ taskId, trainees, reviewers, isPublished }: { taskId: string; trainees: TraineeOpt[]; reviewers: { id: string; name: string }[]; isPublished: boolean }) {
  const o = useOp();
  const r = useOp();
  const [sel, setSel] = useState<string[]>([]);
  const [reviewerId, setReviewerId] = useState("");
  const summary = (d: unknown) => { const x = d as { created: number; alreadyAssigned: number }; return `${x.created} created, ${x.alreadyAssigned} already assigned.`; };
  return (
    <div className="flex flex-col gap-4">
      {!isPublished ? <p className="text-[13px] text-amber-700">Publish the task before assigning it.</p> : null}
      <div>
        <div className="mb-1 text-[13px] text-muted">Select trainees (already assigned are marked)</div>
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-md border border-line p-2 text-[13px]">
          {trainees.length === 0 ? <span className="text-muted">No trainees.</span> : trainees.map((t) => (
            <label key={t.id} className="flex items-center gap-2">
              <input type="checkbox" checked={sel.includes(t.id)} onChange={() => setSel((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]))} />
              {t.name} <span className="text-muted">{t.email}</span>{t.assigned ? <span className="text-[11px] text-muted">(assigned)</span> : null}
            </label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button disabled={o.pending || !isPublished || sel.length === 0} onClick={() => o.run("task.assign", { taskId, userIds: sel }, { ok: summary })}>Assign to selected ({sel.length})</Button>
          <Button disabled={o.pending || !isPublished} onClick={() => o.run("task.assign", { taskId, allEnrolled: true }, { ok: summary })}>Assign to all enrolled in program</Button>
          <Status error={o.error} message={o.message} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Reviewer for all assignments of this task:</span>
        <select aria-label="Reviewer" className={inputCls} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
          <option value="">(none / any reviewer)</option>{reviewers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Button disabled={r.pending} onClick={() => r.run("assignment.setReviewer", { taskId, reviewerId: reviewerId || null }, { ok: (d) => `${(d as { updated: number }).updated} assignments updated.` })}>Apply</Button>
        <Status error={r.error} message={r.message} />
      </div>
    </div>
  );
}

export function ReferencePanel({ taskId, summary, initialJson }: { taskId: string; summary: { total: number; byClass: Record<string, number>; frames: number; hasPointLabels: boolean } | null; initialJson: string }) {
  const o = useOp();
  const [text, setText] = useState(initialJson);
  const [localErr, setLocalErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[13px] text-amber-800">Hidden from trainees. Used only for advisory metrics and the reviewer overlay.</p>
      <p className="text-[13px]">
        {summary ? <>Objects: <strong>{summary.total}</strong> ({Object.entries(summary.byClass).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}); frames: {summary.frames}; point labels: {summary.hasPointLabels ? "yes" : "no"}</> : "No reference annotation."}
      </p>
      <textarea rows={10} className={areaCls} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Reference annotation JSON" />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={o.pending} onClick={() => {
          setLocalErr(null);
          let v: unknown;
          try { v = JSON.parse(text); } catch (e) { setLocalErr(`JSON: ${(e as Error).message}`); return; }
          void o.run("task.setReference", { id: taskId, reference: v }, { ok: () => "Reference replaced." });
        }}>Replace reference</Button>
        <Button disabled={o.pending} onClick={() => { if (window.confirm("Remove the reference annotation?")) void o.run("task.setReference", { id: taskId, reference: null }); }}>Clear</Button>
        <Status error={localErr ?? o.error} message={localErr ? null : o.message} />
      </div>
    </div>
  );
}

export function NewTaskForm({ programs, assets }: { programs: { id: string; name: string }[]; assets: { id: string; name: string }[] }) {
  const o = useOp();
  const [f, setF] = useState({ programId: programs[0]?.id ?? "", code: "", title: "", assetId: assets[0]?.id ?? "", annotationType: "CUBOID" });
  return (
    <form className="grid max-w-3xl grid-cols-1 gap-3 text-[13px] md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void o.run("task.create", f, { navigate: (d) => `/admin/tasks/${d.id}` }); }}>
      <label className="flex flex-col gap-1"><span className="text-muted">Program</span><select className={inputCls} value={f.programId} onChange={(e) => setF({ ...f, programId: e.target.value })}>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="flex flex-col gap-1"><span className="text-muted">Code (unique)</span><input required pattern="[A-Za-z0-9_-]+" className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
      <label className="flex flex-col gap-1 md:col-span-2"><span className="text-muted">Title</span><input required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="flex flex-col gap-1"><span className="text-muted">Asset</span><select className={inputCls} value={f.assetId} onChange={(e) => setF({ ...f, assetId: e.target.value })}>{assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="flex flex-col gap-1"><span className="text-muted">Annotation type</span><select className={inputCls} value={f.annotationType} onChange={(e) => setF({ ...f, annotationType: e.target.value })}>{["INSPECTION", "IDENTIFICATION", "CUBOID", "SEMANTIC_SEG", "INSTANCE_SEG", "TRACKING", "ERROR_DETECTION", "MIXED"].map((t) => <option key={t}>{t}</option>)}</select></label>
      <div className="flex items-center gap-3 md:col-span-2"><Button type="submit" variant="primary" disabled={o.pending}>Create task</Button><Status error={o.error} message={o.message} /></div>
    </form>
  );
}

export function TraineeReviewerPanel({ userId, reviewers }: { userId: string; reviewers: { id: string; name: string }[] }) {
  const o = useOp();
  const [reviewerId, setReviewerId] = useState("");
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-muted">Reviewer for all of this trainee&apos;s assignments:</span>
      <select aria-label="Reviewer" className={inputCls} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
        <option value="">(none / any reviewer)</option>{reviewers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <Button disabled={o.pending} onClick={() => o.run("assignment.setReviewer", { userId, reviewerId: reviewerId || null }, { ok: (d) => `${(d as { updated: number }).updated} assignments updated.` })}>Apply</Button>
      <Status error={o.error} message={o.message} />
    </div>
  );
}
