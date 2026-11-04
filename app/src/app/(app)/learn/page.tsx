import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getLearnOverview } from "@/lib/learn/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Heartbeat } from "@/components/learn/Heartbeat";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  locked: "That section is locked. Complete all mandatory modules and pass the final assessment first.",
  forbidden: "You do not have access to that page.",
  "module-locked": "That module is locked. Complete the previous module first.",
  "assessment-locked": "The final assessment opens once every mandatory module is complete.",
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const user = await requireUser();
  const { msg } = await searchParams;
  const notice = msg ? MESSAGES[msg] : undefined;
  const ov = await getLearnOverview(user.id, user.role);
  const finalText = !ov
    ? ""
    : ov.final.passed
      ? `passed ${ov.final.bestScore ?? ""}%`.replace(" %", "")
      : ov.final.available
        ? ov.final.bestScore !== null ? `available (best so far ${ov.final.bestScore}%)` : "available"
        : "not yet available";
  return (
    <>
      <Heartbeat />
      <PageHeader title="Learn" subtitle={ov ? ov.program.name : "Modules, lessons and knowledge checks."} />
      {notice ? <p role="status" className="mb-4 rounded-md border border-line bg-accent-tint px-3 py-2 text-[13px]">{notice}</p> : null}
      {!ov || ov.modules.length === 0 ? (
        <EmptyState title="No learning content yet" description="Modules will appear here once the program content is seeded." />
      ) : (
        <>
          <div className="mb-4 border border-line bg-panel px-3 py-2 text-[13px]">
            <div className="font-medium">{ov.mandatoryDone} of {ov.mandatoryTotal} modules complete · final assessment: {finalText}</div>
            <p className="mt-1 text-muted">
              Annotate, Review and Complete unlock when every mandatory module is complete (all lessons done and the module quiz passed) and you pass the final assessment with {ov.program.passingScore}% or more.
              {ov.learnCompletedAt ? " You have completed Learn: those sections are unlocked." : ""}
            </p>
          </div>
          <table className="w-full border border-line text-[13px]">
            <thead className="bg-panel text-left text-[12px] text-muted">
              <tr>
                <th className="w-10 border-b border-line px-2 py-1.5 font-medium">#</th>
                <th className="border-b border-line px-2 py-1.5 font-medium">Module</th>
                <th className="w-16 border-b border-line px-2 py-1.5 font-medium">Time</th>
                <th className="w-24 border-b border-line px-2 py-1.5 font-medium">Lessons</th>
                <th className="w-32 border-b border-line px-2 py-1.5 font-medium">Quiz</th>
                <th className="w-28 border-b border-line px-2 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ov.modules.map((m, i) => (
                <tr key={m.id} className={m.locked ? "text-muted" : ""}>
                  <td className="border-b border-line px-2 py-2">{i + 1}</td>
                  <td className="border-b border-line px-2 py-2">
                    {m.locked ? <span className="font-medium">{m.title}</span> : <Link href={`/learn/${m.key}`} className="font-medium underline-offset-2 hover:underline">{m.title}</Link>}
                    {!m.isMandatory ? <span className="ml-2 text-[11px] text-muted">optional track</span> : null}
                    <div className="text-[12px] text-muted">{m.summary}</div>
                  </td>
                  <td className="border-b border-line px-2 py-2">{m.estimatedMinutes} min</td>
                  <td className="border-b border-line px-2 py-2">{m.lessonsDone}/{m.lessonsTotal}</td>
                  <td className="border-b border-line px-2 py-2">{m.quizPassed ? `Passed ${m.bestScore ?? ""}%`.replace(" %", "") : m.bestScore !== null ? `Best ${m.bestScore}%` : m.quizCount ? "Not taken" : "None"}</td>
                  <td className="border-b border-line px-2 py-2">{m.locked ? <StatusBadge status="LOCKED" /> : <StatusBadge status={m.status} />}</td>
                </tr>
              ))}
              <tr className={ov.final.available ? "" : "text-muted"}>
                <td className="px-2 py-2">★</td>
                <td className="px-2 py-2">
                  {ov.final.available ? <Link href="/learn/assessment" className="font-medium underline-offset-2 hover:underline">Final assessment</Link> : <span className="font-medium">Final assessment</span>}
                  <div className="text-[12px] text-muted">{ov.final.questionCount} questions · pass mark {ov.program.passingScore}% · {ov.final.available ? "retries allowed" : "opens after all mandatory modules"}</div>
                </td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2">{ov.final.attempts ? `${ov.final.attempts} attempt${ov.final.attempts > 1 ? "s" : ""}` : "None"}</td>
                <td className="px-2 py-2">{ov.final.passed ? <StatusBadge status="COMPLETED" /> : ov.final.available ? <StatusBadge status={ov.final.attempts ? "IN_PROGRESS" : "NOT_STARTED"} /> : <StatusBadge status="LOCKED" />}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
