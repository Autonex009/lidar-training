import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewTaskForm } from "@/components/admin/TaskPanels";

export default async function NewTaskPage() {
  await requireUser(["ADMIN"]);
  const [programs, assets] = await Promise.all([
    db.trainingProgram.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.pointCloudAsset.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="New task" subtitle="Creates an unpublished draft; fill in the rest on the next screen." />
      {assets.length === 0 ? <p className="text-[13px] text-muted">Upload an asset first.</p> : <NewTaskForm programs={programs} assets={assets} />}
    </>
  );
}
