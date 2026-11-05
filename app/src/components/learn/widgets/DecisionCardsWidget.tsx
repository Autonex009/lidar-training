"use client";

import { useMemo, useState } from "react";
import type { CardsConfig, DecisionCard, FigureId } from "@/content";
import { Button } from "@/components/ui/Button";
import { scoreDecisionCards, seededShuffle } from "@/lib/learn/interactive";
import { Figure } from "../figures";
import { Feedback } from "./Parts";
import type { WidgetProps } from "./types";

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Scenario cards: read a situation, choose what to do, get immediate feedback and the reason.
 * The checkpoint `answered` ticks once every card has an answer, `passed` at the pass mark (default 80%).
 * Below the pass mark the learner retries only the cards they got wrong.
 */
export function DecisionCardsWidget({ onDone, instructions, config }: WidgetProps & { config: CardsConfig }) {
  const passPct = config.passPct ?? 80;
  const cards = config.cards;
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});
  /** Cards still to be shown in this round (all at first, then only the wrong ones). */
  const [queue, setQueue] = useState<string[]>(() => cards.map((c) => c.id));
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const score = scoreDecisionCards(cards, answers, passPct);
  const card: DecisionCard | undefined = cards.find((c) => c.id === queue[pos]);
  const roundOver = pos >= queue.length;

  // choice order is shuffled per card (deterministic) so the right answer is not always in the same place
  const order = useMemo(() => (card ? seededShuffle(card.choices.map((_, i) => i), hash(card.id)) : []), [card]);

  const choose = (i: number) => {
    if (!card || picked !== null) return;
    setPicked(i);
    const next = { ...answers, [card.id]: i };
    setAnswers(next);
    const s = scoreDecisionCards(cards, next, passPct);
    if (s.allAnswered) onDone("answered");
    if (s.passed) onDone("passed");
  };
  const advance = () => { setPicked(null); setPos((p) => p + 1); };
  const retry = () => {
    const wrong = score.wrongIds;
    setAnswers((a) => { const n = { ...a }; for (const id of wrong) delete n[id]; return n; });
    setQueue(wrong);
    setPos(0);
    setPicked(null);
  };
  const restartAll = () => { setAnswers({}); setQueue(cards.map((c) => c.id)); setPos(0); setPicked(null); };

  return (
    <div data-testid="decision-cards">
      <p className="mb-2 text-[13px]">{instructions}</p>
      {!roundOver && card ? (
        <div className="border border-line">
          <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-1.5 text-[12px] text-muted">
            <span>Scenario {pos + 1} of {queue.length}{queue.length < cards.length ? " (retry)" : ""}</span>
            <span className="flex gap-1" aria-hidden>{queue.map((id, i) => <span key={id} className={`h-1.5 w-4 rounded-full ${i < pos ? "bg-success" : i === pos ? "bg-ink" : "bg-line"}`} />)}</span>
          </div>
          <div className="space-y-3 p-3">
            <h3 className="text-[15px] font-semibold" data-testid="card-title">{card.title}</h3>
            <p className="text-[14px] leading-relaxed">{card.scenario}</p>
            {card.figure ? <div className="max-w-md"><Figure id={card.figure as FigureId} /></div> : null}
            <div className="grid gap-2" role="group" aria-label="What do you do?">
              {order.map((i) => {
                const ch = card.choices[i];
                const isPicked = picked === i, isRight = i === card.correct;
                const state = picked === null ? "" : isRight ? "border-success bg-success/10" : isPicked ? "border-danger bg-danger/10" : "opacity-60";
                return (
                  <button key={i} type="button" disabled={picked !== null} data-testid={`choice-${i}`} data-correct={isRight ? "true" : "false"} onClick={() => choose(i)}
                    className={`rounded-md border border-line px-3 py-2 text-left text-[13.5px] enabled:hover:bg-panel ${state}`}>
                    <span className="font-medium">{ch.label}</span>
                    {picked !== null && (isPicked || isRight) ? <span className="mt-0.5 block text-[12.5px] text-muted">{ch.why}</span> : null}
                  </button>
                );
              })}
            </div>
            {picked !== null ? (
              <div className="flex items-center justify-between gap-3">
                <Feedback tone={picked === card.correct ? "good" : "bad"} testId="card-feedback">{picked === card.correct ? "Correct." : `Not this one. ${card.choices[card.correct].label} is the right call.`}</Feedback>
                <Button variant="primary" data-testid="card-next" onClick={advance}>{pos === queue.length - 1 ? "See result" : "Next scenario"}</Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="border border-line p-3" data-testid="cards-result">
          <div className="text-[15px] font-semibold">{score.correctCount} of {score.total} correct ({score.pct}%)</div>
          {score.passed ? (
            <p className="mt-1 text-[13.5px]">You passed (pass mark {passPct}%).{score.wrongIds.length ? " You can still retry the scenarios you missed." : ""}</p>
          ) : (
            <p className="mt-1 text-[13.5px]">You need {passPct}% to pass. Retry the scenarios you got wrong.</p>
          )}
          <div className="mt-2 flex gap-2">
            {score.wrongIds.length ? <Button variant={score.passed ? "secondary" : "primary"} data-testid="cards-retry" onClick={retry}>Retry the wrong ones ({score.wrongIds.length})</Button> : null}
            {score.wrongIds.length === 0 ? <Button data-testid="cards-restart" onClick={restartAll}>Practise again</Button> : null}
          </div>
        </div>
      )}
    </div>
  );
}
