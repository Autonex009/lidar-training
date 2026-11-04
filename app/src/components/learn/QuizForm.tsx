"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
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
        <div role="status" className={`mb-4 border px-3 py-2 text-[13px] ${outcome.passed ? "border-success bg-[#f0f9f0]" : "border-[#e5484d] bg-[#fdf2f2]"}`}>
          <b>{outcome.passed ? "Passed" : "Not passed"}</b>: {outcome.score}% ({outcome.correctCount} of {outcome.total} correct). Pass mark {outcome.passingScore}%.
          {outcome.learnCompleted ? " Annotate, Review and Complete are now unlocked." : ""}
          {outcome.moduleCompleted ? " Module complete." : ""}
          {!outcome.passed ? " Review the explanations below and try again." : ""}
          <div className="mt-2 flex gap-2">
            {!outcome.passed ? <Button variant="primary" onClick={retry}>Retry</Button> : null}
            <Link href={nextHref} className="inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-[13px] font-medium hover:bg-panel">{nextLabel}</Link>
          </div>
        </div>
      ) : null}
      <ol className="space-y-5">
        {questions.map((q, qi) => {
          const g = graded?.get(q.id);
          const opts = q.kind === "TRUE_FALSE" ? ["True", "False"] : q.options;
          return (
            <li key={q.id} className="border border-line p-3">
              <div className="mb-1 flex items-center gap-2 text-[12px] text-muted">
                <span>Question {qi + 1} of {questions.length}</span><span>·</span><span>{KIND_LABEL[q.kind] ?? q.kind}</span>
                {g ? <span className={`ml-auto font-medium ${g.correct ? "text-success" : "text-[#c53030]"}`}>{g.correct ? "Correct" : "Incorrect"}</span> : null}
              </div>
              <p className="mb-2 text-[14px] font-medium">{q.prompt}</p>
              {q.media ? <div className="mb-2"><MediaView media={q.media} programSlug={programSlug} /></div> : null}
              <div role="radiogroup" className="space-y-1">
                {opts.map((o, oi) => {
                  const value: number | boolean = q.kind === "TRUE_FALSE" ? oi === 0 : oi;
                  const selected = answers[q.id] === value;
                  const isRight = g && g.correctAnswer === value;
                  return (
                    <label key={oi} className={`flex cursor-pointer items-start gap-2 rounded border px-2 py-1.5 text-[13px] ${isRight ? "border-success bg-[#f0f9f0]" : selected ? "border-ink bg-accent-tint" : "border-line hover:bg-panel"}`}>
                      <input type="radio" name={q.id} className="mt-0.5" checked={selected} disabled={Boolean(outcome)} onChange={() => setAnswers((a) => ({ ...a, [q.id]: value }))} />
                      <span className="flex-1">{o}</span>
                      {isRight ? <Check on /> : null}
                    </label>
                  );
                })}
              </div>
              {g ? <p className="mt-2 text-[13px] text-muted"><b className="text-ink">Why: </b>{g.explanation}</p> : null}
            </li>
          );
        })}
      </ol>
      {error ? <p role="alert" className="mt-3 text-[13px] text-[#c53030]">{error}</p> : null}
      {!outcome ? (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <Link href={backHref} className="text-[13px] underline">Back</Link>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-muted">{answered} of {questions.length} answered</span>
            <Button variant="primary" disabled={pending || answered === 0} onClick={submit}>{pending ? "Submitting…" : "Submit answers"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
