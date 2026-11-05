"use client";

import { useMemo, useRef, useState } from "react";
import { PointCloudViewer, assetFrameSource, type ControlKind, type ViewerApi } from "@/components/viewer";
import type { DrillConfig } from "@/content";
import { Button } from "@/components/ui/Button";
import { countLabel, gradeCount, gradeTallest } from "@/lib/learn/interactive";
import type { RefBox } from "@/lib/learn/interactive";
import { Feedback } from "./Parts";
import type { AssetRef, WidgetProps } from "./types";

type Step = "top-view" | "top-count" | "front-view" | "front-tallest" | "done";

/**
 * Two drills that force the learner to use the views: switch to Top and count the vehicles, then switch to Front and
 * say which class is tallest. Checkpoints: top-view, top-count, front-view, front-tallest.
 */
export function ViewsDrillWidget({ onDone, instructions, asset, refs, config }: WidgetProps & { asset: AssetRef | null; refs: RefBox[]; config: DrillConfig }) {
  const frames = useMemo(() => (asset ? assetFrameSource(asset.assetId, asset.frameCount) : null), [asset]);
  const api = useRef<ViewerApi>(null);
  const [step, setStep] = useState<Step>("top-view");
  const stepRef = useRef(step);
  stepRef.current = step;
  const [count, setCount] = useState("");
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "hint"; text: string } | null>(null);
  const truth = countLabel(refs, config.countLabel);

  const onControl = (kind: ControlKind, detail?: string) => {
    if (kind !== "preset") return;
    if (stepRef.current === "top-view" && detail === "top") { onDone("top-view"); setStep("top-count"); setMsg(null); }
    else if (stepRef.current === "front-view" && detail === "front") { onDone("front-view"); setStep("front-tallest"); setMsg(null); }
  };

  const submitCount = () => {
    const n = Number(count);
    if (count.trim() === "" || !Number.isFinite(n)) return setMsg({ tone: "bad", text: "Enter a number." });
    if (gradeCount(n, truth)) {
      onDone("top-count");
      setStep("front-view");
      setMisses(0);
      setMsg({ tone: "good", text: `Yes, ${truth}. From above, vehicles are the long rectangles of points, about 4.5 m by 2 m. Now check heights from the side.` });
    } else {
      const m = misses + 1;
      setMisses(m);
      setMsg(m >= 2 ? { tone: "hint", text: `Not ${n}. Hint: vehicles are the biggest rectangular footprints on the ground. Skip buildings, poles and trees.` } : { tone: "bad", text: `Not ${n}. Zoom in and count the vehicle footprints again.` });
    }
  };
  const chooseTallest = (o: string) => {
    if (gradeTallest(o, refs, config.tallestOptions)) {
      onDone("front-tallest");
      setStep("done");
      setMisses(0);
      setMsg({ tone: "good", text: `${o} is the tallest. Height is only visible from the front and side views; the top view cannot show it.` });
    } else {
      const m = misses + 1;
      setMisses(m);
      setMsg(m >= 2 ? { tone: "hint", text: "Hint: compare the tops of the clusters against the grid. The tallest one reaches the highest." } : { tone: "bad", text: `Not ${o}. Compare how high each one reaches.` });
    }
  };

  const prompt =
    step === "top-view" ? "Switch to Top view (toolbar: Top)." :
    step === "top-count" ? `Top view: how many ${config.countLabel.toLowerCase()}s do you see?` :
    step === "front-view" ? "Switch to Front view (toolbar: Front)." :
    step === "front-tallest" ? "Front view: which of these is the tallest?" : "Both drills done.";

  return (
    <div data-testid="views-drill">
      <p className="mb-2 text-[13px]">{instructions}</p>
      <div className="mb-2 flex flex-wrap items-center gap-3 border border-line bg-panel px-3 py-2" data-testid="drill-prompt" data-step={step}>
        <b className="text-[14px]">{prompt}</b>
        {step === "top-count" ? (
          <span className="flex items-center gap-2">
            <input aria-label="Vehicle count" data-testid="drill-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCount(); }} className="h-8 w-16 rounded-md border border-line px-2 text-[13px]" />
            <Button variant="primary" data-testid="drill-count-submit" onClick={submitCount}>Check</Button>
          </span>
        ) : null}
        {step === "front-tallest" ? (
          <span className="flex flex-wrap gap-1.5" role="group" aria-label="Tallest class">
            {config.tallestOptions.map((o) => <button key={o} type="button" data-testid={`drill-tallest-${o}`} onClick={() => chooseTallest(o)} className="h-8 rounded-md border border-line bg-surface px-3 text-[13px] font-medium hover:bg-panel">{o}</button>)}
          </span>
        ) : null}
      </div>
      <div className="h-[400px]">
        {frames ? <PointCloudViewer ref={api} frames={frames} onControlUsed={onControl} title="Use the view buttons" /> : <p className="text-[13px] text-muted">Demo scene not available.</p>}
      </div>
      {msg ? <div className="mt-2"><Feedback tone={msg.tone}>{msg.text}</Feedback></div> : null}
    </div>
  );
}
