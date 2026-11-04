"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Labeled } from "./client";
import { areaCls, inputCls } from "./ui";

export function AssetUploadForm({ binPresets }: { binPresets: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [format, setFormat] = useState("");
  const [preset, setPreset] = useState("");
  return (
    <form
      className="grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null); setDone(null); setBusy(true);
        const fd = new FormData(e.currentTarget);
        // Drop empty optional fields; the endpoint treats missing as default/auto-detect.
        for (const [k, v] of [...fd.entries()]) if (typeof v === "string" && v.trim() === "") fd.delete(k);
        try {
          const res = await fetch("/api/assets/upload", { method: "POST", body: fd });
          const body = (await res.json()) as { error?: string; id?: string; name?: string; pointCount?: number; originalPointCount?: number };
          if (!res.ok) setError(body.error ?? `Upload failed (${res.status})`);
          else { setDone(`Uploaded "${body.name}" (${body.pointCount} points rendered of ${body.originalPointCount}).`); (e.target as HTMLFormElement).reset(); setFormat(""); setPreset(""); router.refresh(); }
        } catch (er) { setError(er instanceof Error ? er.message : "Network error"); }
        setBusy(false);
      }}
    >
      <Labeled label="File (PLY, PCD, XYZ/PTS, LAS, BIN)"><input required type="file" name="file" accept=".ply,.pcd,.xyz,.pts,.las,.bin" className="text-[13px]" /></Labeled>
      <Labeled label="Name (optional)"><input name="name" className={inputCls} /></Labeled>
      <Labeled label="Up axis"><select name="upAxis" defaultValue="Z" className={inputCls}><option>Z</option><option>Y</option></select></Labeled>
      <Labeled label="Format override" hint="Blank = detect from file name">
        <select name="format" value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}><option value="">auto</option>{["ply", "pcd", "xyz", "pts", "las", "bin"].map((f) => <option key={f}>{f}</option>)}</select>
      </Labeled>
      <Labeled label="BIN record schema preset" hint="Required for .bin unless a custom schema is given">
        <select value={preset} onChange={(e) => setPreset(e.target.value)} className={inputCls}><option value="">none</option>{binPresets.map((p) => <option key={p}>{p}</option>)}</select>
      </Labeled>
      <Labeled label="or custom record schema JSON"><textarea name={preset ? undefined : "recordSchema"} rows={3} disabled={Boolean(preset)} className={areaCls} placeholder='{"recordBytes":16,"fields":[...]}' /></Labeled>
      {preset ? <input type="hidden" name="recordSchema" value={preset} /> : null}
      <Labeled label="Description (optional)"><input name="description" className={inputCls} /></Labeled>
      <div className="flex items-end gap-3 md:col-span-2">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Uploading..." : "Upload"}</Button>
        {done ? <span className="text-[13px] text-green-700">{done}</span> : null}
      </div>
      {error ? <pre role="alert" className="whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-2 text-[12px] text-red-700 md:col-span-3">Parser error: {error}</pre> : null}
    </form>
  );
}
