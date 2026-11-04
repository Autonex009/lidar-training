import { notFound, redirect } from "next/navigation";
import { requireSection } from "@/lib/guard";
import { getWorkspace, logTaskOpened } from "@/lib/tasks/service";
import { AnnotateWorkspace } from "@/components/annotate/AnnotateWorkspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const user = await requireSection("annotate");
  const { assignmentId } = await params;
  const r = await getWorkspace(user, assignmentId);
  if (!r.ok) {
    if (r.status === 423) redirect("/annotate");
    notFound();
  }
  await logTaskOpened(user, assignmentId);
  return <AnnotateWorkspace key={assignmentId} data={r.data} />;
}
