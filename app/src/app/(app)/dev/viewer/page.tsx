import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { assetsRoot } from "@/lib/assets-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { ViewerDemo } from "./ViewerDemo";
import type { CuboidOverlay } from "@/components/viewer";

export const dynamic = "force-dynamic";

/** Developer-only viewer sandbox. Not linked from the nav. */
export default async function DevViewerPage() {
  await requireUser(["ADMIN"]);
  const asset = await db.pointCloudAsset.findFirst({ where: { cachePath: "demo-cuboid-basic", isSynthetic: true } });
  if (!asset) notFound();
  const refFile = path.join(assetsRoot(), "demo-cuboid-basic", "reference.json");
  const ref = JSON.parse(fs.readFileSync(refFile, "utf8")) as { cuboids: { id: string; label: string; center: [number, number, number]; dims: [number, number, number]; yaw: number }[] };
  const cuboids: CuboidOverlay[] = ref.cuboids.map((c) => ({ id: c.id, label: c.label, center: c.center, dims: c.dims, yaw: c.yaw, selectable: true }));
  return (
    <div>
      <PageHeader title="Viewer sandbox" subtitle="Dev only: demo-cuboid-basic with reference cuboids as overlays." />
      <ViewerDemo assetId={asset.id} frameCount={asset.frameCount} cuboids={cuboids} />
    </div>
  );
}
