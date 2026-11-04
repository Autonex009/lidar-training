import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/admin/ui";
import { AssetPreview } from "@/components/admin/AssetPreview";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const a = await db.pointCloudAsset.findUnique({ where: { id }, include: { tasks: { select: { id: true, code: true } } } });
  if (!a) notFound();
  return (
    <>
      <PageHeader title={a.name} subtitle={`${a.format} - ${a.pointCount.toLocaleString("en-US")} points - ${a.frameCount} frame(s) - up axis ${a.upAxis}`} />
      <div className="mb-3 flex items-center gap-3 text-[13px]">
        {a.isSynthetic ? <Badge tone="warn">DEMO / SYNTHETIC TRAINING DATA</Badge> : null}
        <span className="text-muted">Used by: {a.tasks.length ? a.tasks.map((t) => <Link key={t.id} href={`/admin/tasks/${t.id}`} className="mr-2 underline">{t.code}</Link>) : "no tasks"}</span>
        <Link href="/admin/assets" className="ml-auto underline">Back to assets</Link>
      </div>
      <AssetPreview assetId={a.id} frameCount={a.frameCount} title={a.name} />
    </>
  );
}
