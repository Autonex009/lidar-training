import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLearnOverview, getQuestionViews } from "@/lib/learn/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Heartbeat } from "@/components/learn/Heartbeat";
import { QuizForm } from "@/components/learn/QuizForm";

export const dynamic = "force-dynamic";

export default async function AssessmentPage() {
  const user = await requireUser();
  const ov = await getLearnOverview(user.id, user.role);
  // Guard: the final assessment is unavailable (403 semantics) until all mandatory modules are complete.
  if (!ov || !ov.final.available) redirect("/learn?msg=assessment-locked");
  const questions = await getQuestionViews(ov.program.id, null);
  return (
    <>
      <Heartbeat />
      <div className="mb-1 text-[12px] text-muted"><Link href="/learn" className="underline">Learn</Link> / Final assessment</div>
      <PageHeader title="Final assessment" subtitle={`${questions.length} questions · pass mark ${ov.program.passingScore}%. A pass unlocks Annotate, Review and Complete. You can retry if you fail.${ov.final.passed ? " You have already passed; further attempts do not change that." : ""}`} />
      <div className="max-w-[860px]">
        <QuizForm questions={questions} moduleId={null} programSlug={ov.program.slug} backHref="/learn" nextHref={ov.final.passed ? "/annotate" : "/learn"} nextLabel="Continue" />
      </div>
    </>
  );
}
