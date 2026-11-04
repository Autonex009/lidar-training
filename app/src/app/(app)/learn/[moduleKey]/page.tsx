import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { LessonContent } from "@/content";
import { db } from "@/lib/db";
import { assetsRoot } from "@/lib/assets-store";
import { requireUser } from "@/lib/session";
import { getModuleForUser, openModule } from "@/lib/learn/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Heartbeat } from "@/components/learn/Heartbeat";
import { LessonView } from "@/components/learn/LessonView";
import { Check } from "@/components/learn/widgets/Parts";
import type { AssetRef } from "@/components/learn/widgets/types";
import type { ReferenceBox } from "@/components/learn/widgets/CuboidWidget";

export const dynamic = "force-dynamic";

function readReferenceBox(sceneKey: string): ReferenceBox | null {
  try {
    const ref = JSON.parse(fs.readFileSync(path.join(assetsRoot(), sceneKey, "reference.json"), "utf8")) as { cuboids: ReferenceBox[] };
    return ref.cuboids.find((c) => c.label === "Vehicle") ?? ref.cuboids[0] ?? null;
  } catch {
    return null;
  }
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
  const doneIds = new Set((await db.lessonProgress.findMany({ where: { userId: user.id, lessonId: { in: lessons.map((l) => l.id) } } })).map((p) => p.lessonId));
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
  for (const b of content.blocks) {
    if (b.type !== "interactive" || !b.sceneKey) continue;
    const key = b.widget === "cuboid" ? "demo-cuboid-basic" : b.sceneKey;
    const a = await db.pointCloudAsset.findFirst({ where: { cachePath: key, isSynthetic: true } });
    if (a) assets[b.sceneKey] = { assetId: a.id, frameCount: a.frameCount };
    if (b.widget === "cuboid") cuboidRef = readReferenceBox(key);
  }
  const program = await db.trainingProgram.findUniqueOrThrow({ where: { id: overview.program.id } });
  const schema = b2schema(program.labelSchema);

  const isLast = index === lessons.length - 1;
  const base = `/learn/${row.key}`;
  return (
    <>
      <Heartbeat moduleId={row.id} />
      <div className="mb-1 text-[12px] text-muted"><Link href="/learn" className="underline">Learn</Link> / {row.title}</div>
      <PageHeader title={lesson.title} subtitle={`Lesson ${index + 1} of ${lessons.length} · ${lesson.estimatedMinutes} min`} />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Lessons" className="self-start border border-line text-[13px]">
          <div className="border-b border-line bg-panel px-3 py-2 font-medium">{row.title}</div>
          <ul>
            {lessons.map((l, i) => (
              <li key={l.id} className="border-b border-line last:border-b-0">
                <Link href={`${base}?l=${i}`} className={`flex items-center gap-2 px-3 py-2 hover:bg-panel ${i === index ? "bg-accent-tint font-medium" : ""}`}>
                  <Check on={doneIds.has(l.id)} /><span>{l.title}</span>
                </Link>
              </li>
            ))}
            {row.quizCount > 0 ? (
              <li>
                <Link href={`${base}/quiz`} className="flex items-center gap-2 px-3 py-2 hover:bg-panel">
                  <Check on={row.quizPassed} /><span>Module quiz</span>
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
        <main className="max-w-[860px]">
          <LessonView
            key={lesson.id}
            lessonId={lesson.id}
            content={content}
            completed={doneIds.has(lesson.id)}
            programSlug={overview.program.slug}
            assets={assets}
            cuboidRef={cuboidRef}
            schema={schema}
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
