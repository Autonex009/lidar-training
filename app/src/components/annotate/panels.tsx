"use client";

import { useMemo, useState, type ReactNode } from "react";
import { attrApplies } from "@/lib/annotation/task-config";
import { cuboidsOf, type AnnotationDocument, type Cuboid, type Flag } from "@/lib/annotation/types";
import type { Edit } from "@/lib/annotation/reducer";
import type { WorkspaceTask } from "@/lib/tasks/runtime";

const btn = "h-6 rounded border border-line bg-surface px-2 text-[12px] hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50";
const input = "h-6 w-full rounded border border-line bg-surface px-1 text-[12px]";

export function Section({ title, right, children, id }: { title: string; right?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} data-tour={id} className="border-b border-line px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between"><h3 className="text-[12px] font-semibold">{title}</h3>{right}</div>
      {children}
    </section>
  );
}

export interface PanelProps {
  task: WorkspaceTask;
  doc: AnnotationDocument;
  frame: number;
  selectedId: string | null;
  readOnly: boolean;
  colors: Record<string, string>;
  edit: (e: Edit, select?: string | null) => void;
  select: (id: string | null) => void;
  goFrame: (i: number) => void;
}

const nice = (c: Cuboid, i: number, task: WorkspaceTask) => (c.trackId !== undefined ? `#${c.trackId}` : task.annotationType === "IDENTIFICATION" ? `Object ${i + 1}` : `${c.label || "?"} ${i + 1}`);

/** Objects grouped by label with counts, as in the reference editor's Labels panel. */
export function ObjectsList(p: PanelProps) {
  const list = cuboidsOf(p.doc, p.frame);
  const groups = useMemo(() => {
    const m = new Map<string, { c: Cuboid; i: number }[]>();
    list.forEach((c, i) => { const k = c.label || "?"; m.set(k, [...(m.get(k) ?? []), { c, i }]); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);
  const dups = duplicateTracks(list);
  return (
    <div>
      {groups.length === 0 && <p className="text-[12px] text-muted">No objects in this frame.</p>}
      {groups.map(([label, items]) => (
        <div key={label} className="mb-1">
          <div className="flex items-center gap-1.5 py-0.5 text-[12px] font-medium">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.colors[label] ?? "#9ca3af" }} />
            {label === "?" ? "Unidentified" : label}
            <span className="rounded-full bg-panel px-1.5 text-[12px] text-muted">{items.length}</span>
          </div>
          {items.map(({ c, i }) => {
            const target = p.task.targets.find((t) => t.refCuboidId === c.id);
            const flagged = p.doc.flags.some((f) => f.cuboidId === c.id);
            return (
              <button key={c.id} type="button" onClick={() => p.select(c.id === p.selectedId ? null : c.id)} data-testid="object-row"
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[12px] ${c.id === p.selectedId ? "bg-accent-tint" : "hover:bg-panel"}`}>
                <span className="truncate">{nice(c, i, p.task)}{target ? ` - ${target.hint.replace(/^Object |^Large object |^Small object /, "").split(".")[0]}` : ""}</span>
                <span className="ml-2 shrink-0 text-[12px] text-muted">{flagged ? "flag " : ""}{c.trackId !== undefined && dups.has(c.trackId) ? "dup ID" : ""}</span>
              </button>
            );
          })}
        </div>
      ))}
      {dups.size > 0 && <p className="mt-1 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[12px] text-danger-ink">Duplicate track ID in this frame: {[...dups].join(", ")}</p>}
    </div>
  );
}

export function duplicateTracks(list: Cuboid[]): Set<number> {
  const seen = new Set<number>(), dup = new Set<number>();
  for (const c of list) if (c.trackId !== undefined) { if (seen.has(c.trackId)) dup.add(c.trackId); seen.add(c.trackId); }
  return dup;
}

/** Tracks across frames (tracking tasks): one row per track with the frames it appears in. */
export function TracksPanel(p: PanelProps) {
  const tracks = useMemo(() => {
    const m = new Map<number, { label: string; frames: Map<number, string> }>();
    for (const [f, fa] of Object.entries(p.doc.frames)) for (const c of fa.cuboids) {
      if (c.trackId === undefined) continue;
      const t = m.get(c.trackId) ?? { label: c.label, frames: new Map() };
      t.frames.set(Number(f), c.id);
      m.set(c.trackId, t);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [p.doc.frames]);
  if (!tracks.length) return <p className="text-[12px] text-muted">No tracks yet. Give each object a track ID.</p>;
  return (
    <div className="space-y-1">
      {tracks.map(([tid, t]) => (
        <div key={tid} className="text-[12px]">
          <div className="font-medium">#{tid} <span className="font-normal text-muted">{t.label}</span></div>
          <div className="flex flex-wrap gap-0.5">
            {Array.from({ length: p.task.asset.frameCount }, (_, f) => {
              const id = t.frames.get(f);
              return (
                <button key={f} type="button" onClick={() => { p.goFrame(f); if (id) setTimeout(() => p.select(id), 120); }} title={id ? `Frame ${f + 1}` : `Frame ${f + 1}: no box`}
                  className={`h-4 w-4 rounded-sm border text-[12px] leading-none ${id ? "border-accent bg-accent text-white" : "border-line bg-panel text-muted"} ${f === p.frame ? "ring-1 ring-ink" : ""}`}>{f + 1}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AttributeEditor(p: PanelProps & { cuboid: Cuboid; onFit: () => void; onDuplicate: () => void; onDelete: () => void; onFlag: () => void; onReportError?: () => void }) {
  const { cuboid: c, task } = p;
  const attrs = task.attributes.filter((a) => attrApplies(a, c.label));
  const editable = !p.readOnly && task.annotationType !== "INSPECTION";
  const cuboidTask = task.annotationType !== "IDENTIFICATION";
  return (
    <div className="mt-1 space-y-1.5 rounded border border-line bg-panel p-2" data-testid="attribute-editor" data-tour="ws-attributes">
      <label className="flex items-center gap-2 text-[12px]">
        <span className="w-14 shrink-0 text-muted">Label</span>
        <select className={input} value={c.label} disabled={p.readOnly} aria-label="Label" onChange={(e) => p.edit({ type: "patchCuboid", frame: p.frame, id: c.id, patch: { label: e.target.value } })}>
          {(c.label === "?" || !task.classes.some((k) => k.name === c.label)) && <option value={c.label}>{c.label === "?" ? "Choose class..." : c.label}</option>}
          {task.classes.map((k, i) => <option key={k.name} value={k.name}>{i < 9 ? `${i + 1} · ` : ""}{k.name}</option>)}
        </select>
      </label>
      {task.annotationType === "TRACKING" && (
        <label className="flex items-center gap-2 text-[12px]">
          <span className="w-14 shrink-0 text-muted">Track ID</span>
          <input type="number" min={0} step={1} className={input} disabled={p.readOnly} aria-label="Track ID" value={c.trackId ?? ""}
            onChange={(e) => p.edit({ type: "patchCuboid", frame: p.frame, id: c.id, patch: { trackId: e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value))) } })} />
        </label>
      )}
      {cuboidTask && attrs.map((a) => (
        <label key={a.key} className="flex items-center gap-2 text-[12px]">
          <span className="w-14 shrink-0 text-muted" title={a.name}>{a.name.split(" ")[0]}{task.requiredAttributes.includes(a.key) ? " *" : ""}</span>
          <select className={input} value={c.attributes[a.key] ?? ""} disabled={p.readOnly} aria-label={a.name}
            onChange={(e) => p.edit({ type: "setAttribute", frame: p.frame, id: c.id, key: a.key, value: e.target.value })}>
            <option value="">-</option>
            {a.options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
          </select>
        </label>
      ))}
      {cuboidTask && (
        <div className="grid grid-cols-3 gap-1 text-[12px] text-muted">
          {(["L", "W", "H"] as const).map((k, i) => <div key={k}>{k} {c.dims[i].toFixed(2)} m</div>)}
          <div className="col-span-3">Centre {c.center.map((v) => v.toFixed(2)).join(", ")} · yaw {((c.yaw * 180) / Math.PI).toFixed(0)}°</div>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {editable && cuboidTask && <button type="button" className={btn} onClick={p.onFit} title="Snap box to the points inside it (G)">Fit to points</button>}
        {editable && cuboidTask && task.annotationType !== "ERROR_DETECTION" && <button type="button" className={btn} onClick={p.onDuplicate} title="Ctrl+D">Duplicate</button>}
        {editable && cuboidTask && <button type="button" className={btn} onClick={p.onDelete} title="Del">Delete</button>}
        {!p.readOnly && <button type="button" className={btn} onClick={p.onFlag}>Flag uncertain</button>}
        {!p.readOnly && p.onReportError && <button type="button" className={btn} onClick={p.onReportError}>Report error</button>}
      </div>
    </div>
  );
}

export function FlagsList({ flags, readOnly, onRemove, onSelect }: { flags: Flag[]; readOnly: boolean; onRemove: (id: string) => void; onSelect: (f: Flag) => void }) {
  if (!flags.length) return <p className="text-[12px] text-muted">No flags. Flag anything uncertain with a reason.</p>;
  return (
    <ul className="space-y-1">
      {flags.map((f) => (
        <li key={f.id} className="flex items-start justify-between gap-1 rounded border border-line px-2 py-1 text-[12px]" data-testid="flag-row">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(f)}>
            <span className="block truncate font-medium">{f.cuboidId ? "Box flag" : "Point flag"}{f.frame !== undefined ? ` · frame ${f.frame + 1}` : ""}</span>
            <span className="block text-muted">{f.reason}</span>
          </button>
          {!readOnly && <button type="button" className="text-[12px] text-muted underline" onClick={() => onRemove(f.id)}>remove</button>}
        </li>
      ))}
    </ul>
  );
}

export function PendingForm({ title, tags, onCancel, onAdd, hint }: { title: string; tags?: { key: string; name: string }[]; hint?: string; onCancel: () => void; onAdd: (reason: string, tag?: string) => void }) {
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState(tags?.[0]?.key ?? "");
  return (
    <div className="mt-1 space-y-1 rounded border border-accent bg-accent-tint p-2" data-testid="pending-form">
      <div className="text-[12px] font-medium">{title}</div>
      {hint && <div className="text-[12px] text-muted">{hint}</div>}
      {tags && (
        <select className={input} value={tag} aria-label="Error tag" onChange={(e) => setTag(e.target.value)}>
          {tags.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      )}
      <textarea className="min-h-[48px] w-full rounded border border-line bg-surface p-1 text-[12px]" placeholder="Reason / explanation (what evidence is missing or wrong)" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-1">
        <button type="button" className={`${btn} border-accent bg-accent text-white`} disabled={!reason.trim()} onClick={() => onAdd(reason.trim(), tag)}>Add</button>
        <button type="button" className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function CheckpointsPanel({ task, doc }: { task: WorkspaceTask; doc: AnnotationDocument }) {
  const done = task.checkpoints.filter((c) => doc.checkpoints[c.key]).length;
  return (
    <div>
      <p className="mb-1 text-[12px] text-muted">{done} of {task.checkpoints.length} complete. Use the viewer controls; ticks appear automatically.</p>
      <ul className="space-y-0.5">
        {task.checkpoints.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5 text-[12px]" data-testid={`checkpoint-${c.key}`}>
            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[12px] ${doc.checkpoints[c.key] ? "border-success bg-success text-white" : "border-line"}`}>{doc.checkpoints[c.key] ? "✓" : ""}</span>
            <span className={doc.checkpoints[c.key] ? "" : "text-muted"}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function QuestionsForm({ task, doc, readOnly, onAnswer }: { task: WorkspaceTask; doc: AnnotationDocument; readOnly: boolean; onAnswer: (key: string, v: string) => void }) {
  return (
    <div className="space-y-2">
      {task.questions.map((q, i) => (
        <label key={q.key} className="block text-[12px]">
          <span className="mb-0.5 block font-medium">{i + 1}. {q.prompt}</span>
          {q.kind === "single_select" ? (
            <select className={input} disabled={readOnly} value={String(doc.answers[q.key] ?? "")} onChange={(e) => onAnswer(q.key, e.target.value)} aria-label={q.prompt}>
              <option value="">Select...</option>
              {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <textarea className="min-h-[56px] w-full rounded border border-line bg-surface p-1 text-[12px]" disabled={readOnly} value={String(doc.answers[q.key] ?? "")} onChange={(e) => onAnswer(q.key, e.target.value)} aria-label={q.prompt} data-testid={`answer-${q.key}`} />
          )}
        </label>
      ))}
    </div>
  );
}

export function ErrorsList({ doc, task, readOnly, onRemove }: { doc: AnnotationDocument; task: WorkspaceTask; readOnly: boolean; onRemove: (id: string) => void }) {
  const errs = doc.errorsFound ?? [];
  if (!errs.length) return <p className="text-[12px] text-muted">No errors reported yet. Select a box and choose Report error, or use the Missing object tool.</p>;
  return (
    <ul className="space-y-1">
      {errs.map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-1 rounded border border-line px-2 py-1 text-[12px]" data-testid="error-row">
          <span className="min-w-0"><span className="font-medium">{task.errorTags.find((t) => t.key === e.tag)?.name ?? e.tag}</span>{e.targetAnnotationId ? "" : " (missing object)"}<span className="block text-muted">{e.explanation}</span></span>
          {!readOnly && <button type="button" className="text-[12px] text-muted underline" onClick={() => onRemove(e.id)}>remove</button>}
        </li>
      ))}
    </ul>
  );
}
