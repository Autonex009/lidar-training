import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Section, Table, fmtDate, linkCls } from "@/components/admin/ui";
import { AssetUploadForm } from "@/components/admin/AssetUploadForm";
import { OpButton } from "@/components/admin/client";
import { BIN_PRESETS } from "@/lib/pointcloud";

export default async function AssetsPage() {
  await requireUser(["ADMIN"]);
  const assets = await db.pointCloudAsset.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { tasks: true } } } });
  return (
    <>
      <PageHeader title="Assets" subtitle="Point-cloud assets. Synthetic scenes are demo data only." />
      <Section title="Upload">
        <AssetUploadForm binPresets={Object.keys(BIN_PRESETS)} />
      </Section>
      <Section title={`Assets (${assets.length})`}>
        <Table head={["Name", "Format", "Flag", "Points", "Frames", "Up", "Tasks", "Created", ""]}>
          {assets.map((a) => (
            <tr key={a.id}>
              <td><Link href={`/admin/assets/${a.id}`} className={linkCls}>{a.name}</Link></td>
              <td>{a.format}</td>
              <td>{a.isSynthetic ? <Badge tone="warn">DEMO / SYNTHETIC</Badge> : <Badge>uploaded</Badge>}</td>
              <td className="tabular-nums">{a.pointCount.toLocaleString("en-US")}</td><td className="tabular-nums">{a.frameCount}</td><td>{a.upAxis}</td>
              <td className="tabular-nums">{a._count.tasks}</td><td className="whitespace-nowrap">{fmtDate(a.createdAt)}</td>
              <td className="whitespace-nowrap">
                <Link href={`/admin/assets/${a.id}`} className={linkCls}>Preview</Link>
                {a._count.tasks === 0 ? <span className="ml-3"><OpButton op="asset.delete" input={{ id: a.id }} label="Delete" confirm={`Delete asset "${a.name}"?`} variant="ghost" /></span> : null}
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
