"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { LessonBlock, LessonContent } from "@/content";
import { Button } from "@/components/ui/Button";
import { completeLessonAction } from "@/app/(app)/learn/actions";
import { Figure } from "./figures";
import { projectImageUrl } from "./Media";
import { CloudWidget } from "./widgets/CloudWidget";
import { CuboidWidget, type ReferenceBox } from "./widgets/CuboidWidget";
import { NavWidget } from "./widgets/NavWidget";
import { SchemaWidget, type SchemaInput } from "./widgets/SchemaWidget";
import type { AssetRef } from "./widgets/types";

export interface LessonViewProps {
  lessonId: string;
  content: LessonContent;
  completed: boolean;
  programSlug: string;
  assets: Record<string, AssetRef>;
  cuboidRef: ReferenceBox | null;
  schema: SchemaInput | null;
  backHref: string | null;
  nextHref: string;
  nextLabel: string;
}

type Interactive = Extract<LessonBlock, { type: "interactive" }>;

function Block({ b, programSlug }: { b: Exclude<LessonBlock, { type: "interactive" }>; programSlug: string }) {
  switch (b.type) {
    case "explain":
      return (
        <section>
          {b.heading ? <h2 className="mb-1 text-[15px] font-semibold">{b.heading}</h2> : null}
          {b.body.map((p, i) => <p key={i} className="mb-1.5 text-[14px] leading-relaxed">{p}</p>)}
        </section>
      );
    case "bullets":
      return (
        <section>
          <h2 className="mb-1 text-[15px] font-semibold">{b.heading}</h2>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      );
    case "remember":
      return (
        <section className="border-l-4 border-accent bg-accent-tint px-3 py-2">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide">Remember</h2>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      );
    case "mistakes":
      return (
        <section className="border-l-4 border-[#e5484d] bg-[#fdf2f2] px-3 py-2">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide">Common mistakes</h2>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      );
    case "example":
      return (
        <section className="border border-line bg-panel px-3 py-2">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{b.heading}</h2>
          {b.body.map((p, i) => <p key={i} className="mb-1.5 text-[14px]">{p}</p>)}
          {b.imageFile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={projectImageUrl(programSlug, b.imageFile)} alt={b.heading} className="mt-1 max-h-72 w-auto border border-line" />
          ) : null}
        </section>
      );
    case "figure":
      return (
        <figure>
          <Figure id={b.id} />
          <figcaption className="mt-1 text-[12px] text-muted">{b.caption}</figcaption>
        </figure>
      );
  }
}

export function LessonView(p: LessonViewProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(p.completed);

  const interactive = useMemo(() => p.content.blocks.flatMap((b, i) => (b.type === "interactive" ? [[i, b] as const] : [])), [p.content.blocks]);
  const allCheckpointsDone = completed || interactive.every(([i, b]) => b.checkpoints.every((c) => done.has(`${i}:${c.key}`)));

  const markComplete = () =>
    start(async () => {
      setError(null);
      const r = await completeLessonAction({ lessonId: p.lessonId });
      if (!r.ok) return setError(r.error);
      setCompleted(true);
      router.refresh();
    });

  const renderWidget = (i: number, b: Interactive) => {
    const set = new Set(b.checkpoints.filter((c) => completed || done.has(`${i}:${c.key}`)).map((c) => c.key));
    const common = { checkpoints: b.checkpoints, done: set, instructions: b.instructions, onDone: (k: string) => setDone((d) => (d.has(`${i}:${k}`) ? d : new Set(d).add(`${i}:${k}`))) };
    const asset = b.sceneKey ? p.assets[b.sceneKey] ?? null : null;
    switch (b.widget) {
      case "cloud": return <CloudWidget {...common} asset={asset} />;
      case "nav": return <NavWidget {...common} asset={asset} />;
      case "cuboid": return <CuboidWidget {...common} asset={asset} reference={p.cuboidRef} />;
      case "schema": return <SchemaWidget {...common} schema={p.schema} />;
    }
  };

  return (
    <div>
      <div className="space-y-4">
        {p.content.blocks.map((b, i) => (
          <div key={i}>{b.type === "interactive" ? <section className="border border-line p-3">{renderWidget(i, b)}</section> : <Block b={b} programSlug={p.programSlug} />}</div>
        ))}
      </div>
      {error ? <p role="alert" className="mt-3 text-[13px] text-[#c53030]">{error}</p> : null}
      <div className="mt-6 flex items-center justify-between border-t border-line pt-3">
        {p.backHref ? <Link href={p.backHref} className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] font-medium hover:bg-panel">Back</Link> : <span />}
        <div className="flex items-center gap-2">
          {!allCheckpointsDone ? <span className="text-[12px] text-muted">Finish the interactive checkpoints to continue.</span> : null}
          {completed ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-success">Lesson complete</span>
          ) : (
            <Button variant="primary" disabled={!allCheckpointsDone || pending} onClick={markComplete}>{pending ? "Saving…" : "Mark lesson complete"}</Button>
          )}
        </div>
        <Link href={p.nextHref} className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] font-medium hover:bg-panel">{p.nextLabel}</Link>
      </div>
    </div>
  );
}
