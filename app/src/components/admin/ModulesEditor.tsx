"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Status, useOp } from "./client";
import { inputCls } from "./ui";

export interface ModuleRowValue { id: string; key: string; title: string; summary: string; estimatedMinutes: number; isMandatory: boolean; trackKey: string | null; lessons: number; questions: number }

export function ModulesEditor({ programId, initial }: { programId: string; initial: ModuleRowValue[] }) {
  const o = useOp();
  const [rows, setRows] = useState(initial);
  const patch = (id: string, p: Partial<ModuleRowValue>) => setRows((r) => r.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const move = async (i: number, d: -1 | 1) => {
    const next = [...rows];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    await o.run("module.reorder", { programId, moduleIds: next.map((m) => m.id) }, { ok: () => "Order saved." });
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted">Lessons are content-seeded and read-only here. Edit title, summary, minutes and whether the module is mandatory; reorder with the arrows.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead><tr className="border-b border-line text-left text-muted"><th className="p-1">#</th><th className="p-1">Title</th><th className="p-1">Summary</th><th className="p-1">Min</th><th className="p-1">Mandatory</th><th className="p-1">Track</th><th className="p-1">Lessons</th><th className="p-1">Quiz Qs</th><th /></tr></thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.id} className="border-b border-line align-top">
                <td className="p-1 whitespace-nowrap">
                  {i + 1}
                  <button type="button" aria-label="Move up" disabled={i === 0 || o.pending} className="ml-1 px-1 disabled:opacity-30" onClick={() => move(i, -1)}>^</button>
                  <button type="button" aria-label="Move down" disabled={i === rows.length - 1 || o.pending} className="px-1 disabled:opacity-30" onClick={() => move(i, 1)}>v</button>
                </td>
                <td className="p-1"><input className={`${inputCls} w-56`} value={m.title} onChange={(e) => patch(m.id, { title: e.target.value })} /></td>
                <td className="p-1"><textarea rows={2} className="w-72 rounded-md border border-line bg-surface p-1 text-[13px]" value={m.summary} onChange={(e) => patch(m.id, { summary: e.target.value })} /></td>
                <td className="p-1"><input type="number" min={1} className={`${inputCls} w-16`} value={m.estimatedMinutes} onChange={(e) => patch(m.id, { estimatedMinutes: Number(e.target.value) })} /></td>
                <td className="p-1"><input type="checkbox" aria-label="Mandatory" checked={m.isMandatory} onChange={(e) => patch(m.id, { isMandatory: e.target.checked })} /></td>
                <td className="p-1 text-muted">{m.trackKey ?? "-"}</td>
                <td className="p-1 tabular-nums">{m.lessons}</td>
                <td className="p-1 tabular-nums">{m.questions}</td>
                <td className="p-1"><Button disabled={o.pending} onClick={() => o.run("module.update", { id: m.id, title: m.title, summary: m.summary, estimatedMinutes: m.estimatedMinutes, isMandatory: m.isMandatory }, { ok: () => `Saved "${m.title}".` })}>Save</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Status error={o.error} message={o.message} />
    </div>
  );
}
