"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Labeled, Status, useOp } from "./client";
import { LabelSchemaEditor, type LabelSchemaValue } from "./LabelSchemaEditor";
import { areaCls, inputCls, Section } from "./ui";

export interface ProgramFormValue {
  id: string; name: string; description: string; passingScore: number; navigationProfile: string; upAxis: string;
  yawConvention: string; boxDefinition: string; isActive: boolean; labelSchema: LabelSchemaValue; enabledTracks: string[]; requiredTaskCodes: string[];
}

export function ProgramSettingsForm({ initial, tracks, tasks }: { initial: ProgramFormValue; tracks: { key: string; label: string }[]; tasks: { code: string; title: string }[] }) {
  const o = useOp();
  const [f, setF] = useState(initial);
  const set = <K extends keyof ProgramFormValue>(k: K, v: ProgramFormValue[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => {
      e.preventDefault();
      void o.run("program.update", { ...f, passingScore: Number(f.passingScore) }, { ok: () => "Program saved. Tracks applied to modules and tasks." });
    }}>
      <Section title="General">
        <div className="grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-3">
          <Labeled label="Name"><input required className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} /></Labeled>
          <Labeled label="Passing score (%)"><input type="number" min={0} max={100} className={inputCls} value={f.passingScore} onChange={(e) => set("passingScore", Number(e.target.value))} /></Labeled>
          <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active (available for enrollment)</label>
          <div className="md:col-span-3"><Labeled label="Description"><textarea rows={3} className={areaCls + " font-sans text-[13px]"} value={f.description} onChange={(e) => set("description", e.target.value)} /></Labeled></div>
          <Labeled label="Navigation profile"><select className={inputCls} value={f.navigationProfile} onChange={(e) => set("navigationProfile", e.target.value)}><option>orbit</option><option>fly</option></select></Labeled>
          <Labeled label="Up axis"><select className={inputCls} value={f.upAxis} onChange={(e) => set("upAxis", e.target.value)}><option>Z</option><option>Y</option></select></Labeled>
          <Labeled label="Yaw convention"><input className={inputCls} value={f.yawConvention} onChange={(e) => set("yawConvention", e.target.value)} /></Labeled>
          <Labeled label="Box definition"><input className={inputCls} value={f.boxDefinition} onChange={(e) => set("boxDefinition", e.target.value)} /></Labeled>
        </div>
      </Section>
      <Section title="Enabled tracks">
        <p className="mb-2 text-[13px] text-muted">Enabling a track makes its modules mandatory and publishes its tasks; disabling does the opposite. Applied on save.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          {tracks.map((t) => <label key={t.key} className="flex items-center gap-1.5"><input type="checkbox" checked={f.enabledTracks.includes(t.key)} onChange={() => set("enabledTracks", toggle(f.enabledTracks, t.key))} />{t.label} <code className="text-muted">{t.key}</code></label>)}
        </div>
      </Section>
      <Section title="Certification requirements (required tasks)">
        {tasks.length === 0 ? <p className="text-[13px] text-muted">This program has no tasks yet.</p> : (
          <div className="flex flex-col gap-1 text-[13px]">
            {tasks.map((t) => <label key={t.code} className="flex items-center gap-1.5"><input type="checkbox" checked={f.requiredTaskCodes.includes(t.code)} onChange={() => set("requiredTaskCodes", toggle(f.requiredTaskCodes, t.code))} /><code>{t.code}</code> {t.title}</label>)}
          </div>
        )}
      </Section>
      <Section title="Label schema">
        <LabelSchemaEditor value={f.labelSchema} onChange={(v) => set("labelSchema", v)} />
      </Section>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-surface py-3">
        <Button type="submit" variant="primary" disabled={o.pending}>Save program</Button>
        <Status error={o.error} message={o.message} />
      </div>
    </form>
  );
}
