"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checklist } from "./Parts";
import type { WidgetProps } from "./types";

interface Attr { id: number; name: string; required: boolean }
interface Cls { id: number; name: string; attrs: Attr[] }

export interface SchemaInput {
  classes?: { name: string; attributes?: unknown }[];
  attributes?: { key: string; name: string; required?: boolean }[];
}

function initial(schema: SchemaInput | null, next: () => number): Cls[] {
  const attrByKey = new Map((schema?.attributes ?? []).map((a) => [a.key, a]));
  return (schema?.classes ?? []).map((c) => ({
    id: next(),
    name: c.name,
    attrs: (Array.isArray(c.attributes) ? (c.attributes as string[]) : []).map((k) => ({ id: next(), name: attrByKey.get(k)?.name ?? k, required: Boolean(attrByKey.get(k)?.required) })),
  }));
}

/** Editable schema table (local state only): the schema is configuration, not code. */
export function SchemaWidget({ checkpoints, done, onDone, instructions, schema }: WidgetProps & { schema: SchemaInput | null }) {
  const counter = useRef(1);
  const next = () => counter.current++;
  const [rows, setRows] = useState<Cls[]>(() => initial(schema, next));
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const fire = (key: string) => {
    const known = checkpoints.some((c) => c.key === key);
    for (const c of checkpoints) if (c.key === key || (!known && !["add-class", "add-attribute", "set-required"].includes(c.key))) onDone(c.key);
  };
  const addClass = () => { setRows((r) => [...r, { id: next(), name: `New class ${r.length + 1}`, attrs: [] }]); fire("add-class"); };
  const addAttr = (cid: number) => {
    const name = (drafts[cid] ?? "").trim();
    if (!name) return;
    setRows((r) => r.map((c) => (c.id === cid ? { ...c, attrs: [...c.attrs, { id: next(), name, required: false }] } : c)));
    setDrafts((d) => ({ ...d, [cid]: "" }));
    fire("add-attribute");
  };
  const toggleReq = (cid: number, aid: number) => {
    const target = rows.find((c) => c.id === cid)?.attrs.find((a) => a.id === aid);
    setRows((r) => r.map((c) => (c.id === cid ? { ...c, attrs: c.attrs.map((a) => (a.id === aid ? { ...a, required: !a.required } : a)) } : c)));
    if (target && !target.required) fire("set-required");
  };

  return (
    <div>
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="max-h-[360px] overflow-auto border border-line">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-panel text-left text-[12px] text-muted">
            <tr><th className="w-[200px] border-b border-line px-2 py-1.5 font-medium">Class</th><th className="border-b border-line px-2 py-1.5 font-medium">Attributes (tick = required)</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="border-b border-line px-2 py-1.5">
                  <input aria-label="Class name" className="w-full rounded border border-line px-1.5 py-1" value={c.name}
                    onChange={(e) => { const v = e.target.value; setRows((r) => r.map((x) => (x.id === c.id ? { ...x, name: v } : x))); }} />
                </td>
                <td className="border-b border-line px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.attrs.map((a) => (
                      <label key={a.id} className="inline-flex items-center gap-1 rounded border border-line bg-panel px-1.5 py-0.5 text-[12px]">
                        <input type="checkbox" checked={a.required} onChange={() => toggleReq(c.id, a.id)} />{a.name}
                      </label>
                    ))}
                    <input aria-label="New attribute" placeholder="new attribute" className="w-28 rounded border border-line px-1.5 py-0.5 text-[12px]"
                      value={drafts[c.id] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addAttr(c.id); }} />
                    <Button className="h-6 px-2 text-[12px]" onClick={() => addAttr(c.id)}>Add</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2"><Button onClick={addClass}>Add class</Button><span className="ml-2 text-[12px] text-muted">Changes here are local to this exercise.</span></div>
      <Checklist checkpoints={checkpoints} done={done} />
    </div>
  );
}
