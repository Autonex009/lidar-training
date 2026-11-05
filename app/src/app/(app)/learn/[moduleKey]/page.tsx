import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { LessonContent } from "@/content";
import { db } from "@/lib/db";
import { assetsRoot } from "@/lib/assets-store";
import { requireUser } from "@/lib/session";
import { getCheckpoints, getModuleForUser, openModule } from "@/lib/learn/service";
import type { RefBox } from "@/lib/learn/interactive";
import { PageHeader } from "@/components/ui/PageHeader";
import { Heartbeat } from "@/components/learn/Heartbeat";
import { LessonView } from "@/components/learn/LessonView";
import { Check } from "@/components/learn/widgets/Parts";
import type { AssetRef } from "@/components/learn/widgets/types";
import type { ReferenceBox } from "@/components/learn/widgets/CuboidWidget";
import type { AnnotatedBox } from "@/components/learn/widgets/SpotErrorWidget";

export const dynamic = "force-dynamic";

function readJson<T>(sceneKey: string, file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(assetsRoot(), sceneKey, file), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Reference cuboids of a demo scene (the hidden ground truth of the synthetic training scene). */
function readReferenceBoxes(sceneKey: string): RefBox[] {
  const ref = readJson<{ cuboids: RefBox[] }>(sceneKey, "reference.json");
  return (ref?.cuboids ?? []).map((c) => ({ label: c.label, center: c.center, dims: c.dims, yaw: c.yaw }));
}

function readReferenceBox(sceneKey: string): ReferenceBox | null {
  const all = readReferenceBoxes(sceneKey);
  return all.find((c) => c.label === "Vehicle") ?? all[0] ?? null;
}

/** The deliberately flawed boxes of a demo scene (spot-the-error). */
function readAnnotatedBoxes(sceneKey: string): AnnotatedBox[] {
  const meta = readJson<{ initialAnnotation?: AnnotatedBox[] }>(sceneKey, "meta.json");
  return (meta?.initialAnnotation ?? []).map((c) => ({ id: c.id, label: c.label, center: c.center, dims: c.dims, yaw: c.yaw }));
}

export default async function ModulePage({ params, searchParams }: { params: Promise<{ moduleKey: string }>; searchParams: Promise<{ l?: string }> }) {
  const user = await requireUser();
  const { moduleKey } = await params;
  const found = await getModuleForUser(user.id, user.role, moduleKey);
  if (!found) notFound();
  if (found.row.locked) redirect("/learn?msg=module-locked");
  const { row, overview } = found;
  await openModule(user.id, row.id);

  const lessons = await db.lesson.findMany({ where: { moduleId: row.id }, orderBy: { order: "asc" } });
  // a LessonProgress row without completedAt only holds checkpoints
  const doneIds = new Set((await db.lessonProgress.findMany({ where: { userId: user.id, completedAt: { not: null }, lessonId: { in: lessons.map((l) => l.id) } } })).map((p) => p.lessonId));
  const sp = await searchParams;
  const requested = Number.parseInt(sp.l ?? "", 10);
  const firstOpen = lessons.findIndex((l) => !doneIds.has(l.id));
  const index = Number.isInteger(requested) && requested >= 0 && requested < lessons.length ? requested : Math.max(0, firstOpen);
  const lesson = lessons[index];
  if (!lesson) notFound();
  const content = lesson.content as unknown as LessonContent;

  // Resolve demo assets by cachePath === sceneKey. The cuboid exercise uses the demo-cuboid-basic scene.
  const assets: Record<string, AssetRef> = {};
  let cuboidRef: ReferenceBox | null = null;
  const refs: Record<string, RefBox[]> = {};
  const annotations: Record<string, AnnotatedBox[]> = {};
  for (const b of content.blocks) {
    if (b.type !== "interactive" || !b.sceneKey) continue;
    const key = b.widget === "cuboid" ? "demo-cuboid-basic" : b.sceneKey;
    const a = await db.pointCloudAsset.findFirst({ where: { cachePath: key, isSynthetic: true } });
    if (a) assets[b.sceneKey] = { assetId: a.id, frameCount: a.frameCount };
    if (b.widget === "cuboid" || b.widget === "cuboid-live") cuboidRef = readReferenceBox(key);
    if (b.widget === "find-object" || b.widget === "views-drill") refs[b.sceneKey] = readReferenceBoxes(key);
    if (b.widget === "spot-the-error") annotations[b.sceneKey] = readAnnotatedBoxes(key);
  }
  const initialDone = await getCheckpoints(user.id, lesson.id);
  const program = await db.trainingProgram.findUniqueOrThrow({ where: { id: overview.program.id } });
  const schema = b2schema(program.labelSchema);

  const isLast = index === lessons.length - 1;
  const base = `/learn/${row.key}`;
  const nextLesson = lessons[index + 1];
  const nextPreview = nextLesson ? `Lesson ${index + 2}: ${nextLesson.title}` : row.quizCount > 0 ? `the knowledge check (${row.quizCount} questions)` : "back to the module list";
  return (
    <>
      <Heartbeat moduleId={row.id} />
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-[13px] text-muted"><Link href="/learn" className="hover:text-ink hover:underline">Learn</Link><span aria-hidden>/</span><span>{row.title}</span></nav>
      <PageHeader title={lesson.title} subtitle={`Lesson ${index + 1} of ${lessons.length} · ${row.title}`} />
      <div className="grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
        <nav aria-label="Lessons" className="self-start rounded-xl border border-line bg-surface p-4 text-[14px] lg:sticky lg:top-20">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">{row.title}</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full grad-bar" style={{ width: `${Math.round(((doneIds.size + (row.quizPassed ? 1 : 0)) / (lessons.length + (row.quizCount > 0 ? 1 : 0))) * 100)}%` }} /></div>
          <ol>
            {lessons.map((l, i) => {
              const done = doneIds.has(l.id);
              const cur = i === index;
              return (
                <li key={l.id} className="relative">
                  {i < lessons.length - 1 || row.quizCount > 0 ? <span aria-hidden className={`absolute left-[13px] top-9 bottom-0 w-0.5 ${done ? "bg-accent" : "bg-line"}`} /> : null}
                  <Link href={`${base}?l=${i}`} className={`relative flex items-start gap-3 rounded-[10px] px-1.5 py-2 hover:bg-panel ${cur ? "bg-accent-tint font-medium text-ink" : "text-body"}`} aria-current={cur ? "step" : undefined}>
                    <Check on={done} n={i + 1} current={cur} /><span className="pt-0.5 leading-5">{l.title}</span>
                  </Link>
                </li>
              );
            })}
            {row.quizCount > 0 ? (
              <li>
                <Link href={`${base}/quiz`} className="flex items-start gap-3 rounded-[10px] px-1.5 py-2 text-body hover:bg-panel">
                  <Check on={row.quizPassed} icon="quiz" /><span className="pt-0.5 leading-5">Module quiz</span>
                </Link>
              </li>
            ) : null}
          </ol>
        </nav>
        <main className="min-w-0">
          <LessonView
            key={lesson.id}
            lessonId={lesson.id}
            content={content}
            completed={doneIds.has(lesson.id)}
            initialDone={initialDone}
            programSlug={overview.program.slug}
            assets={assets}
            cuboidRef={cuboidRef}
            refs={refs}
            annotations={annotations}
            schema={schema}
            lessonIndex={index}
            lessonCount={lessons.length}
            nextPreview={nextPreview}
            quizHref={row.quizCount > 0 ? `${base}/quiz` : null}
            otherLessonsDone={lessons.every((l) => l.id === lesson.id || doneIds.has(l.id))}
            backHref={index > 0 ? `${base}?l=${index - 1}` : "/learn"}
            nextHref={isLast ? (row.quizCount > 0 ? `${base}/quiz` : "/learn") : `${base}?l=${index + 1}`}
            nextLabel={isLast ? (row.quizCount > 0 ? "Module quiz" : "Back to modules") : "Next"}
          />
        </main>
      </div>
    </>
  );
}

function b2schema(v: unknown) {
  return v && typeof v === "object" ? (v as import("@/components/learn/widgets/SchemaWidget").SchemaInput) : null;
}
