"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Ring } from "@/components/ui/Ring";
import { submitFinalAction, submitQuizAction } from "@/app/(app)/learn/actions";
import type { QuizOutcome, QuizQuestionView } from "@/lib/learn/service";
import { Check } from "./widgets/Parts";
import { MediaView } from "./Media";

type Answers = Record<string, number | boolean | null>;

const KIND_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple choice", TRUE_FALSE: "True / false", INTERPRETATION: "Interpret the evidence",
  IDENTIFY_INCORRECT: "Find the incorrect annotation", CHOOSE_DECISION: "Choose the correct decision", IDENTIFY_OBJECT: "Identify the object",
};

export function QuizForm({
  questions, moduleId, programSlug, backHref, nextHref, nextLabel,
}: { questions: QuizQuestionView[]; moduleId: string | null; programSlug: string; backHref: string; nextHref: string; nextLabel: string }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const answered = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== null).length;
  const graded = outcome ? new Map(outcome.questions.map((g) => [g.questionId, g])) : null;

  const submit = () =>
    start(async () => {
      setError(null);
      const r = moduleId ? await submitQuizAction({ moduleId, answers }) : await submitFinalAction({ answers });
      if (!r.ok) return setError(r.error);
      setOutcome(r.outcome);
      window.scrollTo({ top: 0 });
    });

  const retry = () => { setAnswers({}); setOutcome(null); window.scrollTo({ top: 0 }); };

  return (
    <div>
      {outcome ? (
        <div role="status" className={`mb-6 flex flex-wrap items-center gap-5 rounded-xl border p-5 text-[14px] shadow-float ${outcome.passed ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
          <Ring value={outcome.score} size={64} label={`Score ${outcome.score}%`} />
          <div className="min-w-0 flex-1 basis-72">
            <p className="text-[16px] font-semibold text-ink"><b>{outcome.passed ? "Passed" : "Not passed"}</b>: {outcome.score}% ({outcome.correctCount} of {outcome.total} correct). Pass mark {outcome.passingScore}%.</p>
            <p className="mt-0.5 text-body">
              {outcome.learnCompleted ? "Annotate, Review and Complete are now unlocked." : ""}
              {outcome.moduleCompleted ? " Module complete." : ""}
              {!outcome.passed ? " Review the explanations below and try again." : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {!outcome.passed ? <Button variant="primary" size="lg" onClick={retry}>Retry</Button> : null}
            <ButtonLink href={nextHref} size="lg" variant={outcome.passed ? "primary" : "secondary"}>{nextLabel}</ButtonLink>
          </div>
        </div>
      ) : null}
      <ol className="space-y-4">
        {questions.map((q, qi) => {
          const g = graded?.get(q.id);
          const opts = q.kind === "TRUE_FALSE" ? ["True", "False"] : q.options;
          return (
            <li key={q.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ${g ? (g.correct ? "bg-success text-white" : "bg-danger text-white") : "bg-accent-tint text-accent"}`} aria-hidden>{qi + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    <span>Question {qi + 1} of {questions.length}</span><span>·</span><span>{KIND_LABEL[q.kind] ?? q.kind}</span>
                    {g ? <span className={`ml-auto font-semibold ${g.correct ? "text-success-ink" : "text-danger-ink"}`}>{g.correct ? "Correct" : "Incorrect"}</span> : null}
                  </div>
                  <p className="mb-3 text-[16px] font-semibold leading-6 text-ink">{q.prompt}</p>
                  {q.media ? <div className="mb-3"><MediaView media={q.media} programSlug={programSlug} /></div> : null}
                  <div role="radiogroup" className="space-y-2">
                    {opts.map((o, oi) => {
                      const value: number | boolean = q.kind === "TRUE_FALSE" ? oi === 0 : oi;
                      const selected = answers[q.id] === value;
                      const isRight = g && g.correctAnswer === value;
                      const wrong = g && selected && !isRight;
                      return (
                        <label key={oi} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-[14px] ${isRight ? "border-success bg-success/10" : wrong ? "border-danger bg-danger/10" : selected ? "border-accent bg-accent-tint" : "border-line hover:border-accent/40 hover:bg-panel"}`}>
                          <input type="radio" name={q.id} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={selected} disabled={Boolean(outcome)} onChange={() => setAnswers((a) => ({ ...a, [q.id]: value }))} />
                          <span className="flex-1">{o}</span>
                          {isRight ? <Check on /> : null}
                        </label>
                      );
                    })}
                  </div>
                  {g ? <p className="mt-3 rounded-lg bg-panel px-3 py-2 text-[14px] text-body"><b className="text-ink">Why: </b>{g.explanation}</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {error ? <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p> : null}
      {!outcome ? (
        <div className="sticky bottom-4 mt-5 flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-float">
          <ButtonLink href={backHref} className="h-10 px-4 text-[14px]">Back</ButtonLink>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex" aria-hidden>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line"><div className="h-full grad-bar" style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} /></div>
            </div>
            <span className="text-[14px] text-muted">{answered} of {questions.length} answered</span>
            <Button variant="primary" size="lg" disabled={pending || answered === 0} onClick={submit}>{pending ? "Submitting…" : "Submit answers"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
