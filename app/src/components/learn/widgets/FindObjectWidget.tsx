"use client";

import { useMemo, useRef, useState } from "react";
import { PointCloudViewer, assetFrameSource, type CuboidOverlay, type ViewerApi } from "@/components/viewer";
import type { FindConfig } from "@/content";
import { findHit, resolveFindTarget, seededShuffle, type RefBox } from "@/lib/learn/interactive";
import { closeUp } from "./overlays3d";
import { Feedback } from "./Parts";
import type { AssetRef, WidgetProps } from "./types";
import { useViewerClick } from "./useViewerClick";

type Phase = "click" | "label";

/**
 * "Click the <thing>" prompts on a demo scene. A click counts when it lands inside the reference cuboid (or the region
 * radius, or on empty ground). Two misses show a hint. With `label` options the learner also names what they found.
 */
export function FindObjectWidget({ onDone, instructions, asset, refs, config }: WidgetProps & { asset: AssetRef | null; refs: RefBox[]; config: FindConfig }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const api = useRef<ViewerApi>(null);
  const order = useMemo(() => seededShuffle(config.prompts, config.seed), [config]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("click");
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "hint" | "info"; text: string } | null>(null);
  const [solved, setSolved] = useState<string[]>([]);
  const prompt = order[idx] ?? null;
  const finished = idx >= order.length;

  const resolved = useMemo(() => (prompt ? resolveFindTarget(prompt.target, refs) : null), [prompt, refs]);

  const complete = (why: string) => {
    if (!prompt) return;
    onDone(prompt.id);
    setSolved((s) => [...s, prompt.id]);
    setMsg({ tone: "good", text: why });
    setMisses(0);
    setPhase("click");
    setIdx((i) => i + 1);
  };

  useViewerClick(api, Boolean(frames) && !finished && phase === "click", (click) => {
    if (!prompt || !resolved) return;
    if (findHit(resolved, click)) {
      if (prompt.label) { setPhase("label"); setMsg({ tone: "good", text: "Found it. Now name it." }); }
      else complete(prompt.why);
      return;
    }
    const m = misses + 1;
    setMisses(m);
    setMsg(m >= 2 ? { tone: "hint", text: `Not there. Hint: ${prompt.hint}` } : { tone: "bad", text: "Not quite. Look again and click on the points of the object." });
  });

  const chooseLabel = (l: string) => {
    if (!prompt?.label) return;
    if (l === prompt.label.correct) complete(`${l} is right. ${prompt.why}`);
    else setMsg({ tone: "bad", text: `Not ${l}. Look at the shape and height again, then choose another label.` });
  };

  const options = useMemo(() => (prompt?.label ? seededShuffle(prompt.label.options, config.seed + idx + 1) : []), [prompt, config.seed, idx]);

  // highlight what has been found so far
  const overlays = useMemo<CuboidOverlay[]>(() => {
    const out: CuboidOverlay[] = [];
    for (const id of solved) {
      const p = config.prompts.find((x) => x.id === id);
      if (!p) continue;
      const r = resolveFindTarget(p.target, refs);
      if (r.kind === "object") r.boxes.forEach((b, i) => out.push({ id: `${id}-${i}`, center: b.center, dims: b.dims, yaw: b.yaw, color: "#4caf50", selectable: false }));
    }
    return out;
  }, [solved, config.prompts, refs]);

  return (
    <div data-testid="find-object">
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="mb-2 flex items-center justify-between gap-3 border border-line bg-panel px-3 py-2" data-testid="find-prompt">
        {finished ? (
          <span className="text-[14px] font-medium">All found. Nice work.</span>
        ) : (
          <>
            <span className="text-[14px]"><span className="text-muted">{idx + 1} of {order.length} · </span><b>{prompt?.text}</b></span>
            <span className="flex gap-1" aria-hidden>{order.map((p, i) => <span key={p.id} className={`h-1.5 w-4 rounded-full ${i < idx ? "bg-success" : i === idx ? "bg-ink" : "bg-line"}`} />)}</span>
          </>
        )}
      </div>
      {phase === "label" && prompt?.label ? (
        <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="What is it?" data-testid="find-labels">
          <span className="text-[13px]">What is it?</span>
          {options.map((o) => <button key={o} type="button" data-testid={`find-label-${o}`} onClick={() => chooseLabel(o)} className="h-8 rounded-md border border-line bg-surface px-3 text-[13px] font-medium hover:bg-panel">{o}</button>)}
        </div>
      ) : null}
      <div className="h-[400px]">
        {frames ? <PointCloudViewer ref={api} frames={frames} overlays={overlays} onFrameChange={() => setTimeout(() => { const e = api.current?.getEngine(); if (e) closeUp(e, 0.7); }, 50)} title="Find the object" /> : <p className="text-[13px] text-muted">Demo scene not available.</p>}
      </div>
      {msg ? <div className="mt-2"><Feedback tone={msg.tone}>{msg.text}</Feedback></div> : null}
    </div>
  );
}
