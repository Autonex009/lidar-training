import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getReviewDetail } from "@/lib/review/service";
import { FullBleed } from "@/components/ui/FullBleed";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";

export const dynamic = "force-dynamic";

export default async function ReviewSubmissionPage({ params, searchParams }: { params: Promise<{ submissionId: string }>; searchParams: Promise<{ v?: string }> }) {
  const user = await requireUser(["REVIEWER", "ADMIN"]);
  const { submissionId } = await params;
  const { v } = await searchParams;
  const vn = v && /^\d+$/.test(v) ? Number(v) : undefined;
  const r = await getReviewDetail(user, submissionId, vn);
  if (!r.ok) notFound();
  return <FullBleed><ReviewWorkspace key={submissionId + (vn ?? "")} detail={r.data} currentUserId={user.id} /></FullBleed>;
}
