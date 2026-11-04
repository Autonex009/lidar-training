import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getModuleForUser, getQuestionViews, openModule } from "@/lib/learn/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Heartbeat } from "@/components/learn/Heartbeat";
import { QuizForm } from "@/components/learn/QuizForm";

export const dynamic = "force-dynamic";

export default async function ModuleQuizPage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const user = await requireUser();
  const { moduleKey } = await params;
  const found = await getModuleForUser(user.id, user.role, moduleKey);
  if (!found) notFound();
  if (found.row.locked) redirect("/learn?msg=module-locked");
  const { row, overview } = found;
  await openModule(user.id, row.id);
  const questions = await getQuestionViews(overview.program.id, row.id);
  return (
    <>
      <Heartbeat moduleId={row.id} />
      <div className="mb-1 text-[12px] text-muted"><Link href="/learn" className="underline">Learn</Link> / <Link href={`/learn/${row.key}`} className="underline">{row.title}</Link> / Quiz</div>
      <PageHeader title={`${row.title}: knowledge check`} subtitle={`Pass mark ${overview.program.passingScore}%. You can retry as often as you need.${row.lessonsDone < row.lessonsTotal ? " Complete all lessons too: the module counts as complete only when both are done." : ""}`} />
      <div className="max-w-[860px]">
        <QuizForm questions={questions} moduleId={row.id} programSlug={overview.program.slug} backHref={`/learn/${row.key}`} nextHref="/learn" nextLabel="Back to modules" />
      </div>
    </>
  );
}
