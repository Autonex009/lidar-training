import { requireUser } from "@/lib/session";
import { getContinueTarget, getLearnOverview, getLearningSeconds, type ModuleRow } from "@/lib/learn/service";
import { computeProgressPercent } from "@/lib/progress";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { UIcon } from "@/components/ui/Icons";
import { Ring } from "@/components/ui/Ring";
import { Tooltip } from "@/components/ui/Tooltip";
import { Heartbeat } from "@/components/learn/Heartbeat";
import { PageTours } from "@/components/tour/PageTours";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  locked: "That section is locked. Complete all mandatory modules and pass the final assessment first.",
  forbidden: "You do not have access to that page.",
  "module-locked": "That module is locked. Complete the previous module first.",
  "assessment-locked": "The final assessment opens once every mandatory module is complete.",
};

const GATE_TEXT = (pass: number) =>
  `Annotate, Review and Complete unlock when every mandatory module is complete (all lessons done and the module quiz passed) and you pass the final assessment with ${pass}% or more.`;

function formatTime(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)} h ${m % 60} m`;
}

function Stat({ icon, label, value }: { icon: "check" | "clock" | "star"; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent"><UIcon name={icon} size={18} /></span>
      <div>
        <p className="text-[16px] font-semibold leading-5 text-ink">{value}</p>
        <p className="text-[12px] text-muted">{label}</p>
      </div>
    </div>
  );
}

function Rail({ m, n, current }: { m: ModuleRow; n: number; current: boolean }) {
  const cls = m.status === "COMPLETED" ? "border-accent bg-accent text-white" : m.locked ? "border-line bg-panel text-muted" : "border-accent bg-surface text-accent ring-4 ring-[var(--ring)]/30";
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[14px] font-semibold ${cls}`} data-current={current ? "true" : undefined} aria-hidden>
      {m.status === "COMPLETED" ? <UIcon name="check" size={18} /> : m.locked ? <UIcon name="lock" size={15} /> : n}
    </span>
  );
}

function ModuleCard({ m, current, optional, tourFirst }: { m: ModuleRow; current: boolean; optional?: boolean; tourFirst?: boolean }) {
  const newLessons = m.status === "COMPLETED" ? Math.max(0, m.lessonsTotal - m.lessonsDone) : 0;
  const action = m.locked ? null : m.status === "COMPLETED" ? "Review" : m.status === "IN_PROGRESS" ? "Continue" : "Open";
  const quiz = m.quizPassed ? { tone: "success" as const, text: `Quiz ${m.bestScore ?? ""}%`.replace(" %", "") } : m.bestScore !== null ? { tone: "warning" as const, text: `Quiz best ${m.bestScore}%` } : m.quizCount ? { tone: "plain" as const, text: "Quiz not taken" } : null;
  return (
    <div
      data-tour={tourFirst ? "learn-module-first" : undefined}
      data-testid={`module-card-${m.key}`}
      className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-surface p-5 ${optional ? "border-dashed border-line" : current ? "border-accent/40 shadow-float" : "border-line"} ${m.locked ? "bg-panel/60" : ""}`}
    >
      <div className="min-w-0 flex-1 basis-80">
        <h3 className={`text-[16px] font-semibold leading-6 ${m.locked ? "text-muted" : "text-ink"}`}>{m.title}</h3>
        <p className="mt-0.5 text-[14px] text-muted">{m.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip icon="clock">{m.estimatedMinutes} min</Chip>
          <Chip icon="layers">{m.lessonsDone > 0 && m.lessonsDone < m.lessonsTotal ? `${m.lessonsDone}/${m.lessonsTotal}` : m.lessonsTotal} {m.lessonsTotal === 1 ? "lesson" : "lessons"}</Chip>
          {quiz ? <Chip icon="quiz" tone={quiz.tone}>{quiz.text}</Chip> : null}
          {newLessons > 0 ? <Chip tone="primary" icon="star">{newLessons} new lesson{newLessons > 1 ? "s" : ""}</Chip> : null}
          {!m.isMandatory ? <Chip>Optional</Chip> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {m.locked ? null : <StatusBadge status={m.status} />}
        {action ? (
          <ButtonLink href={`/learn/${m.key}`} variant={action === "Review" ? "secondary" : "primary"} className="min-w-24">{action}</ButtonLink>
        ) : (
          <Button disabled className="min-w-24" aria-label={`${m.title} is locked`}><UIcon name="lock" size={13} />Locked</Button>
        )}
      </div>
    </div>
  );
}

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const user = await requireUser();
  const { msg } = await searchParams;
  const notice = msg ? MESSAGES[msg] : undefined;
  const ov = await getLearnOverview(user.id, user.role);
  const [next, seconds] = ov ? await Promise.all([getContinueTarget(user.id, ov), getLearningSeconds(user.id)]) : [null, 0];
  const mandatory = ov?.modules.filter((m) => m.isMandatory) ?? [];
  const optional = ov?.modules.filter((m) => !m.isMandatory) ?? [];
  const currentId = mandatory.find((m) => !m.locked && m.status !== "COMPLETED")?.id;
  const pct = ov ? computeProgressPercent(ov.mandatoryTotal, ov.mandatoryDone, ov.final.passed) : 0;
  const finalScore = ov?.final.bestScore != null ? `${ov.final.bestScore}%` : "Not yet taken";
  const done = Boolean(ov?.learnCompletedAt);
  return (
    <>
      <Heartbeat />
      <PageTours keys={["welcome"]} />
      <PageHeader title="Learn" subtitle="Modules, lessons and knowledge checks, one step at a time." />
      {notice ? <p role="status" className="mb-4 rounded-xl border border-accent/25 bg-accent-tint px-4 py-3 text-[14px]">{notice}</p> : null}
      {!ov || ov.modules.length === 0 ? (
        <EmptyState variant="cloud" title="No learning content yet" description="Modules will appear here once the program content is seeded." />
      ) : (
        <>
          <Card float className="mb-8 p-6">
            <div className="flex flex-wrap items-center gap-6">
              <Ring value={pct} size={64} label={`Program progress ${pct}%`} />
              <div className="min-w-0 flex-1 basis-72">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Your training program</p>
                <h2 className="text-[20px] font-bold leading-7 tracking-tight text-ink">{ov.program.name}</h2>
                <p className="mt-0.5 text-[14px] text-muted">{ov.program.description || "Work through the modules in order, then pass the final assessment to unlock annotation."}</p>
              </div>
              {next ? (
                <ButtonLink href={next.href} variant="primary" size="lg" className="max-w-full">
                  <span className="truncate">{next.kind === "lesson" || next.kind === "quiz" ? `Continue: ${next.label}` : next.kind === "assessment" ? "Take final assessment" : "Go to Annotate"}</span>
                  <UIcon name="arrow" size={16} />
                </ButtonLink>
              ) : null}
            </div>
            <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <Stat icon="check" label="Modules completed" value={`${ov.mandatoryDone}/${ov.mandatoryTotal}`} />
              <Stat icon="clock" label="Time spent learning" value={formatTime(seconds)} />
              <Stat icon="star" label="Final assessment best score" value={finalScore} />
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-1.5 text-[14px] text-body">
              <b className="font-semibold text-ink">{ov.mandatoryDone} of {ov.mandatoryTotal} modules complete</b>
              {done ? (
                <>
                  <span className="text-muted">· Annotate, Review and Complete are unlocked.</span>
                  <Tooltip inline placement="top" text={GATE_TEXT(ov.program.passingScore)}><span className="inline-flex text-muted hover:text-ink" aria-label="How unlocking works"><UIcon name="info" size={16} /></span></Tooltip>
                </>
              ) : (
                <span className="text-muted">· final assessment: {ov.final.available ? (ov.final.bestScore !== null ? `available (best so far ${ov.final.bestScore}%)` : "available") : "not yet available"}</span>
              )}
            </p>
            {!done ? <p className="mt-1 text-[14px] text-muted">{GATE_TEXT(ov.program.passingScore)}</p> : null}
          </Card>

          <h2 className="mb-4 text-[16px] font-semibold text-ink">Learning path</h2>
          <ol className="mb-8" data-tour="learn-modules">
            {mandatory.map((m, i) => (
              <li key={m.id} className="relative pb-4 pl-14">
                <span className="absolute left-0 top-5 z-10"><Rail m={m} n={i + 1} current={m.id === currentId} /></span>
                <span aria-hidden className={`absolute left-[17px] top-14 w-0.5 ${i === mandatory.length - 1 ? "-bottom-7" : "-bottom-5"} ${m.status === "COMPLETED" ? "bg-accent" : "bg-line"}`} />
                <ModuleCard m={m} current={m.id === currentId} tourFirst={i === 0} />
              </li>
            ))}
            <li className="relative pl-14" data-tour="learn-assessment">
              <span className={`absolute left-0 top-7 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 ${ov.final.passed ? "border-accent bg-accent text-white" : ov.final.available ? "border-accent bg-surface text-accent ring-4 ring-[var(--ring)]/30" : "border-line bg-panel text-muted"}`} aria-hidden>
                <UIcon name={ov.final.available || ov.final.passed ? "star" : "lock"} size={16} />
              </span>
              <div className={`rounded-xl p-px ${ov.final.available || ov.final.passed ? "grad-bar" : "bg-line"}`}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-[11px] bg-surface p-6">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${ov.final.available || ov.final.passed ? "bg-accent-tint text-accent" : "bg-panel text-muted"}`}><UIcon name="star" size={24} /></span>
                  <div className="min-w-0 flex-1 basis-72">
                    <h3 className="text-[16px] font-semibold text-ink">Final assessment</h3>
                    <p className="mt-0.5 text-[14px] text-muted">{ov.final.questionCount} questions · pass mark {ov.program.passingScore}% · {ov.final.available ? "retries allowed" : "opens after all mandatory modules"}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Chip icon="flag">{ov.final.attempts ? `${ov.final.attempts} attempt${ov.final.attempts > 1 ? "s" : ""}` : "No attempts yet"}</Chip>
                      <Chip icon="star" tone={ov.final.passed ? "success" : "plain"}>{ov.final.bestScore !== null ? `Best ${ov.final.bestScore}%` : "No score yet"}</Chip>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {ov.final.passed ? <StatusBadge status="COMPLETED" /> : ov.final.available ? <StatusBadge status={ov.final.attempts ? "IN_PROGRESS" : "NOT_STARTED"} /> : null}
                    {ov.final.available ? (
                      <ButtonLink href="/learn/assessment" variant="primary" size="lg">{ov.final.passed ? "Review assessment" : ov.final.attempts ? "Retake assessment" : "Start assessment"}</ButtonLink>
                    ) : (
                      <Button size="lg" disabled><UIcon name="lock" size={14} />Locked</Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          </ol>

          {optional.length > 0 ? (
            <section>
              <h2 className="text-[16px] font-semibold text-ink">Optional tracks</h2>
              <p className="mb-4 text-[14px] text-muted">Extra practice. These do not block Annotate, Review or Complete.</p>
              <ul className="space-y-4">
                {optional.map((m) => <li key={m.id}><ModuleCard m={m} current={false} optional /></li>)}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
