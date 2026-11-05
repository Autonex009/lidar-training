"use client";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { LessonBlock, LessonContent } from "@/content";
import { Button, ButtonLink } from "@/components/ui/Button";
import { UIcon } from "@/components/ui/Icons";
import { completeLessonAction } from "@/app/(app)/learn/actions";
import { Figure } from "./figures";
import { projectImageUrl } from "./Media";
import { CloudWidget } from "./widgets/CloudWidget";
import { CuboidWidget, type ReferenceBox } from "./widgets/CuboidWidget";
import { CuboidLiveWidget } from "./widgets/CuboidLiveWidget";
import { DecisionCardsWidget } from "./widgets/DecisionCardsWidget";
import { FindObjectWidget } from "./widgets/FindObjectWidget";
import { Checklist } from "./widgets/Parts";
import { SpotErrorWidget, type AnnotatedBox } from "./widgets/SpotErrorWidget";
import { ViewsDrillWidget } from "./widgets/ViewsDrillWidget";
import type { RefBox } from "@/lib/learn/interactive";
import { NavWidget } from "./widgets/NavWidget";
import { SchemaWidget, type SchemaInput } from "./widgets/SchemaWidget";
import type { AssetRef } from "./widgets/types";

export interface LessonViewProps {
  lessonId: string;
  content: LessonContent;
  completed: boolean;
  /** Checkpoint keys already saved on the server. */
  initialDone: string[];
  programSlug: string;
  assets: Record<string, AssetRef>;
  cuboidRef: ReferenceBox | null;
  /** Reference cuboids per demo scene key. */
  refs: Record<string, RefBox[]>;
  /** Pre-annotated (flawed) boxes per demo scene key, for spot-the-error. */
  annotations: Record<string, AnnotatedBox[]>;
  schema: SchemaInput | null;
  lessonIndex: number;
  lessonCount: number;
  backHref: string | null;
  nextHref: string;
  nextLabel: string;
  /** One line shown under "Mark lesson complete". */
  nextPreview: string;
  /** Module knowledge check, shown after the last lesson is complete. */
  quizHref: string | null;
  otherLessonsDone: boolean;
}

type Interactive = Extract<LessonBlock, { type: "interactive" }>;

function Block({ b, programSlug }: { b: Exclude<LessonBlock, { type: "interactive" }>; programSlug: string }) {
  switch (b.type) {
    case "explain":
      return (
        <section>
          {b.heading ? <h2 className="mb-1.5 text-[16px] font-semibold text-ink">{b.heading}</h2> : null}
          {b.body.map((p, i) => <p key={i} className="mb-2 text-[14px] leading-relaxed text-body">{p}</p>)}
        </section>
      );
    case "bullets":
      return (
        <section>
          <h2 className="mb-1.5 text-[16px] font-semibold text-ink">{b.heading}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-body marker:text-accent">{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      );
    case "remember":
      return (
        <section className="rounded-xl border border-accent/20 bg-accent-tint px-4 py-3">
          <h2 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-accent"><UIcon name="info" size={14} />Remember</h2>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      );
    case "mistakes":
      return (
        <section className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3">
          <h2 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-danger-ink"><UIcon name="flag" size={14} />Common mistakes</h2>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      );
    case "example":
      return (
        <section className="rounded-xl border border-line bg-panel px-4 py-3">
          <h2 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">{b.heading}</h2>
          {b.body.map((p, i) => <p key={i} className="mb-1.5 text-[14px]">{p}</p>)}
          {b.imageFile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={projectImageUrl(programSlug, b.imageFile)} alt={b.heading} className="mt-1 max-h-72 w-auto rounded-lg border border-line" />
          ) : null}
        </section>
      );
    case "figure":
      return (
        <figure>
          <Figure id={b.id} />
          <figcaption className="mt-1.5 text-[12px] text-muted">{b.caption}</figcaption>
        </figure>
      );
  }
}

export function LessonView(p: LessonViewProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(() => new Set(p.initialDone));
  const [completed, setCompleted] = useState(p.completed);
  const sent = useRef(new Set(p.initialDone));
  /** Saves go one at a time so the server never sees two ticks racing. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const interactive = useMemo(() => p.content.blocks.flatMap((b, i) => (b.type === "interactive" ? [[i, b] as const] : [])), [p.content.blocks]);
  const allKeys = useMemo(() => interactive.flatMap(([, b]) => b.checkpoints.map((c) => c.key)), [interactive]);
  const doneCount = completed ? allKeys.length : allKeys.filter((k) => done.has(k)).length;
  const allCheckpointsDone = completed || doneCount === allKeys.length;

  /** Tick a checkpoint locally and persist it (best effort: the local tick never waits for the network). */
  const tick = useCallback((key: string) => {
    if (!allKeys.includes(key)) return;
    setDone((d) => (d.has(key) ? d : new Set(d).add(key)));
    if (p.completed || sent.current.has(key)) return;
    sent.current.add(key);
    const body = JSON.stringify({ lessonId: p.lessonId, key });
    queue.current = queue.current.then(() =>
      fetch("/api/learn/checkpoint", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body })
        .then((r) => { if (!r.ok) sent.current.delete(key); })
        .catch(() => { sent.current.delete(key); }));
  }, [allKeys, p.lessonId, p.completed]);

  const markComplete = () =>
    start(async () => {
      setError(null);
      const r = await completeLessonAction({ lessonId: p.lessonId });
      if (!r.ok) return setError(r.error);
      setCompleted(true);
      router.refresh();
    });

  const renderWidget = (b: Interactive) => {
    const set = new Set(b.checkpoints.filter((c) => completed || done.has(c.key)).map((c) => c.key));
    const common = { checkpoints: b.checkpoints, done: set, instructions: b.instructions, onDone: tick };
    const asset = b.sceneKey ? p.assets[b.sceneKey] ?? null : null;
    const refs = (b.sceneKey && p.refs[b.sceneKey]) || [];
    switch (b.widget) {
      case "cloud": return <CloudWidget {...common} asset={asset} />;
      case "nav": return <NavWidget {...common} asset={asset} />;
      case "cuboid": return <CuboidWidget {...common} asset={asset} reference={p.cuboidRef} />;
      case "cuboid-live": return <CuboidLiveWidget {...common} asset={asset} reference={p.cuboidRef} />;
      case "schema": return <SchemaWidget {...common} schema={p.schema} />;
      case "find-object": return b.find ? <FindObjectWidget {...common} asset={asset} refs={refs} config={b.find} /> : null;
      case "decision-cards": return b.cards ? <DecisionCardsWidget {...common} config={b.cards} /> : null;
      case "spot-the-error": return b.spot ? <SpotErrorWidget {...common} asset={asset} boxes={(b.sceneKey && p.annotations[b.sceneKey]) || []} config={b.spot} /> : null;
      case "views-drill": return b.drill ? <ViewsDrillWidget {...common} asset={asset} refs={refs} config={b.drill} /> : null;
    }
  };

  const pct = allKeys.length ? Math.round((doneCount / allKeys.length) * 100) : 100;
  return (
    <div>
      <div className="mb-5 overflow-hidden rounded-xl border border-line bg-surface" data-testid="lesson-strip">
        <div className="flex flex-wrap items-center gap-x-2 px-5 py-3 text-[14px]">
          <span className="font-semibold text-ink">Lesson {p.lessonIndex + 1} of {p.lessonCount}</span>
          <span className="text-muted">· {p.content.estimatedMinutes} min</span>
          {allKeys.length ? <span className="text-muted">· <span data-testid="strip-checkpoints">{doneCount}/{allKeys.length} checkpoints</span></span> : null}
          {completed ? <span className="ml-auto inline-flex items-center gap-1 font-medium text-success-ink"><UIcon name="check" size={14} />Complete</span> : null}
        </div>
        <div className="h-1.5 bg-line" aria-hidden><div className="h-1.5 grad-bar" style={{ width: `${completed ? 100 : pct}%` }} /></div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-6 shadow-float">
      <div className="space-y-5">
        {p.content.blocks.map((b, i) => (
          <div key={i}>
            {b.type === "interactive" ? (
              <section className="grid gap-4 rounded-xl border border-line p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0">{renderWidget(b)}</div>
                <aside aria-label="Checkpoints" data-testid="checkpoints" className="self-start rounded-xl border border-line bg-panel p-3 lg:sticky lg:top-3">
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Checkpoints {b.checkpoints.filter((c) => completed || done.has(c.key)).length}/{b.checkpoints.length}</h3>
                  <Checklist checkpoints={b.checkpoints} done={completed ? new Set(allKeys) : done} />
                </aside>
              </section>
            ) : <Block b={b} programSlug={p.programSlug} />}
          </div>
        ))}
      </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p> : null}
      <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border border-line bg-surface p-4">
        {p.backHref ? <ButtonLink href={p.backHref} className="h-10 px-4 text-[14px]">Back</ButtonLink> : <span />}
        <div className="flex flex-col items-center gap-1 text-center">
          {completed ? (
            <span className="inline-flex h-10 items-center gap-1.5 text-[14px] font-medium text-success-ink"><UIcon name="check" size={16} />Lesson complete</span>
          ) : (
            <Button variant={allCheckpointsDone ? "primary" : "secondary"} size="lg" data-testid="mark-complete" disabled={!allCheckpointsDone || pending} onClick={markComplete}>{pending ? "Saving…" : "Mark lesson complete"}</Button>
          )}
          {!completed && !allCheckpointsDone ? <span className="text-[12px] text-muted">Finish the interactive checkpoints to continue.</span> : null}
          <span className="text-[12px] text-muted" data-testid="whats-next">What&apos;s next: {p.nextPreview}</span>
        </div>
        <ButtonLink href={p.nextHref} className="h-10 px-4 text-[14px]">{p.nextLabel}<UIcon name="arrow" size={14} /></ButtonLink>
      </div>
      {p.quizHref && completed && p.otherLessonsDone ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-tint px-5 py-4" data-testid="quiz-cta">
          <span className="text-[14px] text-ink">All lessons in this module are complete. Show what you learned.</span>
          <ButtonLink href={p.quizHref} variant="primary" size="lg">Take the knowledge check</ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
