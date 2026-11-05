"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PointCloudViewer, assetFrameSource, type CuboidOverlay, type ViewerApi } from "@/components/viewer";
import type { SpotConfig } from "@/content";
import { Button } from "@/components/ui/Button";
import { classColor } from "@/lib/annotation/colors";
import { seededShuffle } from "@/lib/learn/interactive";
import { BoxTags } from "./BoxTags";
import { closeUp } from "./overlays3d";
import { Feedback } from "./Parts";
import type { AssetRef, WidgetProps } from "./types";

export interface AnnotatedBox { id: string; label: string; center: [number, number, number]; dims: [number, number, number]; yaw: number }

/**
 * A scene with someone else's boxes on it, some of them wrong. Each prompt names one kind of mistake
 * ("one of these boxes has a wrong yaw") and the learner clicks the offending box.
 */
export function SpotErrorWidget({ onDone, instructions, asset, boxes, config }: WidgetProps & { asset: AssetRef | null; boxes: AnnotatedBox[]; config: SpotConfig }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const api = useRef<ViewerApi>(null);
  const order = useMemo(() => (config.seed === undefined ? config.prompts : seededShuffle(config.prompts, config.seed)), [config]);
  const [idx, setIdx] = useState(0);
  const [misses, setMisses] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "hint"; text: string } | null>(null);
  const prompt = order[idx] ?? null;
  const finished = idx >= order.length;
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  const classes = useMemo(() => [...new Set(boxes.map((b) => b.label))], [boxes]);
  const overlays = useMemo<CuboidOverlay[]>(() => boxes.map((b) => ({ id: b.id, label: b.label, center: b.center, dims: b.dims, yaw: b.yaw, color: classColor(b.label, classes.indexOf(b.label)) })), [boxes, classes]);
  const tags = useMemo(() => boxes.map((b) => ({ id: b.id, text: b.label, pos: [b.center[0], b.center[1], b.center[2] + b.dims[2] / 2 + 0.3] as [number, number, number], color: classColor(b.label, classes.indexOf(b.label)) })), [boxes, classes]);

  const onSelect = (id: string | null) => {
    if (!id || !prompt || solved) return;
    setSelected(id);
    if (prompt.targets.includes(id)) {
      setSolved(true);
      setMsg({ tone: "good", text: prompt.why });
      onDone(prompt.id);
      return;
    }
    const m = misses + 1;
    setMisses(m);
    setMsg(m >= 2 ? { tone: "hint", text: `That box is fine. Hint: ${prompt.hint}` } : { tone: "bad", text: "That box is fine. Look at the others." });
    // let the same box be clicked again
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setSelected(null), 700);
  };
  const next = () => { setIdx((i) => i + 1); setSolved(false); setMisses(0); setSelected(null); setMsg(null); };
  const getEngine = useCallback(() => api.current?.getEngine() ?? null, []);

  return (
    <div data-testid="spot-error">
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="mb-2 flex items-center justify-between gap-3 border border-line bg-panel px-3 py-2" data-testid="spot-prompt">
        {finished ? <span className="text-[14px] font-medium">All errors found.</span> : (
          <>
            <span className="text-[14px]"><span className="text-muted">{idx + 1} of {order.length} · </span><b>{prompt?.text}</b></span>
            <span className="flex gap-1" aria-hidden>{order.map((p, i) => <span key={p.id} className={`h-1.5 w-4 rounded-full ${i < idx || (i === idx && solved) ? "bg-success" : i === idx ? "bg-ink" : "bg-line"}`} />)}</span>
          </>
        )}
      </div>
      <div className="h-[400px]">
        {frames ? (
          <PointCloudViewer ref={api} frames={frames} overlays={overlays} selectedId={selected} onSelect={onSelect} onFrameChange={() => setTimeout(() => { const e = api.current?.getEngine(); if (e) closeUp(e, 0.6); }, 50)} title="Review someone else's boxes">
            <BoxTags getEngine={getEngine} tags={tags} />
          </PointCloudViewer>
        ) : <p className="text-[13px] text-muted">Demo scene not available.</p>}
      </div>
      {msg ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><Feedback tone={msg.tone}>{msg.text}</Feedback></div>
          {solved && !finished && idx < order.length - 1 ? <Button variant="primary" data-testid="spot-next" onClick={next}>Next</Button> : null}
          {solved && idx === order.length - 1 ? <Button variant="primary" data-testid="spot-next" onClick={next}>Finish</Button> : null}
        </div>
      ) : null}
    </div>
  );
}
