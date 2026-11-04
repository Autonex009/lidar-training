"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputCls } from "./ui";

export type AnyObj = Record<string, unknown>;
export interface LabelSchemaValue { classes: AnyObj[]; attributes: AnyObj[]; [k: string]: unknown }

const optsToText = (o: unknown) => (Array.isArray(o) ? (o as { key: string; name: string }[]).map((x) => `${x.key}:${x.name}`).join("\n") : "");
const textToOpts = (t: string) =>
  t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":");
    const key = (i > 0 ? l.slice(0, i) : l).trim();
    return { key, name: (i > 0 ? l.slice(i + 1) : l).trim() };
  });
const appliesToText = (a: unknown) => (Array.isArray(a) ? (a as string[]).join(", ") : "all");

/** Structured editor for labelSchema (classes and attributes). Unknown fields on each entry are preserved. */
export function LabelSchemaEditor({ value, onChange }: { value: LabelSchemaValue; onChange: (v: LabelSchemaValue) => void }) {
  const setClass = (i: number, patch: AnyObj) => onChange({ ...value, classes: value.classes.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setAttr = (i: number, patch: AnyObj) => onChange({ ...value, attributes: value.attributes.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const dims = (c: AnyObj) => (Array.isArray(c.defaultDims) ? (c.defaultDims as number[]) : []);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-1 text-[13px] font-medium">Classes ({value.classes.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-1">Name</th><th className="p-1">Key</th><th className="p-1">Color</th><th className="p-1">Default dims L / W / H (m)</th><th /></tr></thead>
            <tbody>
              {value.classes.map((c, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="p-1"><input className={`${inputCls} w-44`} value={String(c.name ?? "")} onChange={(e) => setClass(i, { name: e.target.value })} aria-label="Class name" /></td>
                  <td className="p-1"><input className={`${inputCls} w-32`} value={String(c.key ?? "")} onChange={(e) => setClass(i, { key: e.target.value || undefined })} aria-label="Class key" /></td>
                  <td className="p-1">
                    <div className="flex items-center gap-1">
                      <input type="color" value={typeof c.color === "string" ? c.color : "#888888"} onChange={(e) => setClass(i, { color: e.target.value })} aria-label="Class color" className="h-8 w-8 border border-line bg-surface" />
                      {c.color ? <button type="button" className="text-[12px] text-muted underline" onClick={() => setClass(i, { color: undefined })}>auto</button> : <span className="text-[12px] text-muted">auto</span>}
                    </div>
                  </td>
                  <td className="p-1">
                    <DimsInput value={dims(c)} onCommit={(d) => setClass(i, { defaultDims: d })} />
                  </td>
                  <td className="p-1"><Button variant="ghost" onClick={() => onChange({ ...value, classes: value.classes.filter((_, j) => j !== i) })}>Remove</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button className="mt-2" onClick={() => onChange({ ...value, classes: [...value.classes, { name: "" }] })}>Add class</Button>
      </div>

      <div>
        <h3 className="mb-1 text-[13px] font-medium">Attributes ({value.attributes.length})</h3>
        <div className="flex flex-col gap-2">
          {value.attributes.map((a, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-line p-2 md:grid-cols-6">
              <label className="text-[12px] text-muted">Key<input className={`${inputCls} w-full`} value={String(a.key ?? "")} onChange={(e) => setAttr(i, { key: e.target.value })} /></label>
              <label className="text-[12px] text-muted">Name<input className={`${inputCls} w-full`} value={String(a.name ?? "")} onChange={(e) => setAttr(i, { name: e.target.value })} /></label>
              <label className="text-[12px] text-muted">Type
                <select className={`${inputCls} w-full`} value={String(a.type ?? "single_select")} onChange={(e) => setAttr(i, { type: e.target.value })}>
                  {["single_select", "multi_select", "boolean", "text", "number"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="flex items-end gap-1 pb-2 text-[13px]"><input type="checkbox" checked={Boolean(a.required)} onChange={(e) => setAttr(i, { required: e.target.checked })} /> Required</label>
              <label className="text-[12px] text-muted">Applies to (all, or class names comma-separated)
                <input className={`${inputCls} w-full`} value={appliesToText(a.appliesTo)} onChange={(e) => { const v = e.target.value.trim(); setAttr(i, { appliesTo: !v || v === "all" ? "all" : v.split(",").map((x) => x.trim()).filter(Boolean) }); }} />
              </label>
              <div className="flex items-end"><Button variant="ghost" onClick={() => onChange({ ...value, attributes: value.attributes.filter((_, j) => j !== i) })}>Remove</Button></div>
              <label className="text-[12px] text-muted md:col-span-6">Options (one per line, key:Name)
                <textarea rows={3} className="w-full rounded-md border border-line bg-surface p-2 text-[13px] text-ink" defaultValue={optsToText(a.options)} onBlur={(e) => setAttr(i, { options: textToOpts(e.target.value) })} />
              </label>
            </div>
          ))}
        </div>
        <Button className="mt-2" onClick={() => onChange({ ...value, attributes: [...value.attributes, { key: "", name: "", type: "single_select", required: false, appliesTo: "all", options: [] }] })}>Add attribute</Button>
      </div>
    </div>
  );
}

/** Three text boxes; commits only when all are positive numbers (or all blank = no default). */
function DimsInput({ value, onCommit }: { value: number[]; onCommit: (d: number[] | undefined) => void }) {
  const [t, setT] = useState<string[]>([0, 1, 2].map((k) => (value[k] !== undefined ? String(value[k]) : "")));
  const set = (k: number, v: string) => {
    const n = t.map((x, j) => (j === k ? v : x));
    setT(n);
    if (n.every((x) => x.trim() === "")) onCommit(undefined);
    else if (n.every((x) => Number(x) > 0)) onCommit(n.map(Number));
  };
  return (
    <div className="flex gap-1">
      {t.map((x, k) => <input key={k} inputMode="decimal" className={`${inputCls} w-16`} aria-label={`Default dim ${k + 1}`} value={x} onChange={(e) => set(k, e.target.value)} />)}
    </div>
  );
}
