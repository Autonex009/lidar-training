"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Labeled, Status, useOp } from "./client";
import { inputCls } from "./ui";

export function NewProgramForm({ availableConfigs }: { availableConfigs: { slug: string; name: string }[] }) {
  const blankOp = useOp();
  const cfgOp = useOp();
  const [name, setName] = useState("");
  const [withMods, setWithMods] = useState(true);
  const [slug, setSlug] = useState(availableConfigs[0]?.slug ?? "");
  const go = (d: { id?: string }) => `/admin/programs/${d.id}`;
  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void blankOp.run("program.create", { mode: "blank", name, withFoundationsModules: withMods }, { navigate: go }); }}>
        <h3 className="text-[13px] font-medium">From scratch (blank label schema)</h3>
        <Labeled label="Program name"><input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Labeled>
        <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={withMods} onChange={(e) => setWithMods(e.target.checked)} /> Include the foundations Learn modules and final assessment</label>
        <div className="flex items-center gap-3"><Button type="submit" variant="primary" disabled={blankOp.pending}>Create blank program</Button><Status error={blankOp.error} message={blankOp.message} /></div>
      </form>
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void cfgOp.run("program.create", { mode: "config", slug }, { navigate: go }); }}>
        <h3 className="text-[13px] font-medium">From project-config folder</h3>
        {availableConfigs.length === 0 ? <p className="text-[13px] text-muted">Every project-config folder is already imported.</p> : (
          <>
            <Labeled label="Project config"><select className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)}>{availableConfigs.map((c) => <option key={c.slug} value={c.slug}>{c.slug} - {c.name}</option>)}</select></Labeled>
            <div className="flex items-center gap-3"><Button type="submit" variant="primary" disabled={cfgOp.pending}>Import program</Button><Status error={cfgOp.error} message={cfgOp.message} /></div>
          </>
        )}
      </form>
    </div>
  );
}
