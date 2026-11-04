"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Labeled, Status, arrayToLines, linesToArray, useOp } from "./client";
import { areaCls, inputCls, Section } from "./ui";

type Row = Record<string, unknown>;
export interface TaskFormValue {
  id: string; title: string; description: string; objective: string; learningOutcome: string; difficulty: string; prerequisiteTaskId: string | null;
  annotationType: string; estimatedMinutes: number; instructions: string[]; requiredOutput: string[]; expectedOutput: string; hints: string[]; commonMistakes: string[];
  scoringCriteria: unknown; reviewerRubric: Row[]; reviewerErrorTags: Row[]; assetId: string; isPublished: boolean; isRequiredForCertification: boolean;
  trackKey: string | null; order: number; configBlocks: unknown;
}
const ANN = ["INSPECTION", "IDENTIFICATION", "CUBOID", "SEMANTIC_SEG", "INSTANCE_SEG", "TRACKING", "ERROR_DETECTION", "MIXED"];

function RowsEditor({ rows, onChange, cols, blank, label }: { rows: Row[]; onChange: (r: Row[]) => void; cols: { k: string; label: string; num?: boolean; wide?: boolean }[]; blank: Row; label: string }) {
  const set = (i: number, p: Row) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-start gap-1.5">
          {cols.map((c) => (
            <input key={c.k} aria-label={`${label} ${c.label}`} placeholder={c.label} type={c.num ? "number" : "text"} className={`${inputCls} ${c.wide ? "min-w-72 flex-1" : "w-36"}`}
              value={String(r[c.k] ?? "")} onChange={(e) => set(i, { [c.k]: c.num ? Number(e.target.value) : e.target.value })} />
          ))}
          <Button variant="ghost" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <div><Button onClick={() => onChange([...rows, { ...blank }])}>Add {label.toLowerCase()}</Button></div>
    </div>
  );
}

export function TaskEditor({ initial, assets, tasks, tracks }: {
  initial: TaskFormValue; assets: { id: string; name: string; isSynthetic: boolean }[]; tasks: { id: string; code: string }[]; tracks: string[];
}) {
  const o = useOp();
  const [f, setF] = useState(initial);
  const [scoring, setScoring] = useState(JSON.stringify(initial.scoringCriteria, null, 2));
  const [config, setConfig] = useState(JSON.stringify(initial.configBlocks, null, 2));
  const [localErr, setLocalErr] = useState<string | null>(null);
  const set = <K extends keyof TaskFormValue>(k: K, v: TaskFormValue[K]) => setF((s) => ({ ...s, [k]: v }));
  const text = (k: "title" | "description" | "objective" | "learningOutcome" | "expectedOutput", label: string, rows = 2) => (
    <Labeled label={label}><textarea rows={rows} className={areaCls + " font-sans text-[13px]"} value={f[k]} onChange={(e) => set(k, e.target.value)} /></Labeled>
  );
  const list = (k: "instructions" | "requiredOutput" | "hints" | "commonMistakes", label: string, hint?: string) => (
    <Labeled label={label} hint={hint ?? "One per line"}><textarea rows={4} className={areaCls + " font-sans text-[13px]"} defaultValue={arrayToLines(f[k])} onBlur={(e) => set(k, linesToArray(e.target.value))} onChange={(e) => set(k, linesToArray(e.target.value))} /></Labeled>
  );
  return (
    <form className="flex max-w-5xl flex-col" onSubmit={(e) => {
      e.preventDefault();
      setLocalErr(null);
      let sc: unknown, cfg: unknown;
      try { sc = JSON.parse(scoring); } catch (er) { setLocalErr(`Scoring criteria JSON: ${(er as Error).message}`); return; }
      try { cfg = JSON.parse(config); } catch (er) { setLocalErr(`Config JSON: ${(er as Error).message}`); return; }
      const { configBlocks: _c, ...rest } = f;
      void _c;
      void o.run("task.update", { ...rest, scoringCriteria: sc, config: cfg, estimatedMinutes: Number(f.estimatedMinutes), order: Number(f.order) }, { ok: (d) => `Saved.${(d as { assignmentsCreated?: number }).assignmentsCreated ? ` ${(d as { assignmentsCreated: number }).assignmentsCreated} assignments created.` : ""}` });
    }}>
      <Section title="Basics">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-3"><Labeled label="Title"><input required className={inputCls + " w-full"} value={f.title} onChange={(e) => set("title", e.target.value)} /></Labeled></div>
          <Labeled label="Difficulty"><select className={inputCls} value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>{["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((d) => <option key={d}>{d}</option>)}</select></Labeled>
          <Labeled label="Annotation type"><select className={inputCls} value={f.annotationType} onChange={(e) => set("annotationType", e.target.value)}>{ANN.map((d) => <option key={d}>{d}</option>)}</select></Labeled>
          <Labeled label="Estimated minutes"><input type="number" min={1} className={inputCls} value={f.estimatedMinutes} onChange={(e) => set("estimatedMinutes", Number(e.target.value))} /></Labeled>
          <Labeled label="Prerequisite task"><select className={inputCls} value={f.prerequisiteTaskId ?? ""} onChange={(e) => set("prerequisiteTaskId", e.target.value || null)}><option value="">None</option>{tasks.filter((t) => t.id !== f.id).map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></Labeled>
          <Labeled label="Asset"><select className={inputCls} value={f.assetId} onChange={(e) => set("assetId", e.target.value)}>{assets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isSynthetic ? " [synthetic]" : ""}</option>)}</select></Labeled>
          <Labeled label="Track key (gates publishing)"><select className={inputCls} value={f.trackKey ?? ""} onChange={(e) => set("trackKey", e.target.value || null)}><option value="">None</option>{tracks.map((t) => <option key={t}>{t}</option>)}</select></Labeled>
          <Labeled label="Order"><input type="number" min={0} className={inputCls} value={f.order} onChange={(e) => set("order", Number(e.target.value))} /></Labeled>
          <label className="flex items-end gap-1.5 pb-2 text-[13px]"><input type="checkbox" checked={f.isPublished} onChange={(e) => set("isPublished", e.target.checked)} /> Published</label>
          <label className="flex items-end gap-1.5 pb-2 text-[13px]"><input type="checkbox" checked={f.isRequiredForCertification} onChange={(e) => set("isRequiredForCertification", e.target.checked)} /> Required for certification</label>
        </div>
      </Section>
      <Section title="Authored content">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {text("description", "Description", 3)}{text("objective", "Objective", 3)}{text("learningOutcome", "Learning outcome")}{text("expectedOutput", "Expected output", 3)}
          {list("instructions", "Instructions (steps)", "One step per line; numbering is added automatically")}{list("requiredOutput", "Required output")}{list("hints", "Hints")}{list("commonMistakes", "Common mistakes")}
        </div>
      </Section>
      <Section title="Reviewer rubric">
        <p className="mb-2 text-[13px] text-muted">Weights should add up to 100. Level descriptors, if any, are preserved.</p>
        <RowsEditor label="Criterion" rows={f.reviewerRubric} onChange={(r) => set("reviewerRubric", r)} blank={{ key: "", name: "", description: "", weight: 0 }}
          cols={[{ k: "key", label: "key" }, { k: "name", label: "name" }, { k: "weight", label: "weight", num: true }, { k: "description", label: "description", wide: true }]} />
        <p className="mt-1 text-[12px] text-muted">Total weight: {f.reviewerRubric.reduce((n, r) => n + (Number(r.weight) || 0), 0)}</p>
      </Section>
      <Section title="Reviewer error tags">
        <RowsEditor label="Tag" rows={f.reviewerErrorTags} onChange={(r) => set("reviewerErrorTags", r)} blank={{ key: "", name: "", description: "" }}
          cols={[{ k: "key", label: "key" }, { k: "name", label: "name" }, { k: "description", label: "description", wide: true }]} />
      </Section>
      <Section title="Scoring criteria (JSON)">
        <textarea rows={6} className={areaCls} value={scoring} onChange={(e) => setScoring(e.target.value)} spellCheck={false} aria-label="Scoring criteria JSON" />
      </Section>
      <Section title="Config blocks (JSON, validated on save)">
        <p className="mb-1 text-[13px] text-muted">inspection, identification, errorDetection, plantedErrors, classIds, labelSchemaOverride, requiredAttributes, classMapping, sceneKey. Required output and error tags are edited above.</p>
        <textarea rows={14} className={areaCls} value={config} onChange={(e) => setConfig(e.target.value)} spellCheck={false} aria-label="Config JSON" />
      </Section>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-surface py-3">
        <Button type="submit" variant="primary" disabled={o.pending}>Save task</Button>
        <Status error={localErr ?? o.error} message={localErr ? null : o.message} />
      </div>
    </form>
  );
}
