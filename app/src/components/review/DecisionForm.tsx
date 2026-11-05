"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LocalTime } from "@/components/ui/LocalTime";
import { Button } from "@/components/ui/Button";
import type { SubmissionMetrics } from "@/lib/annotation/metrics";
import type { ReviewDetail } from "@/lib/review/service";
import { rubricJudgement, suggestedScore } from "@/lib/review/scoring";

const field = "w-full rounded border border-line bg-surface p-1.5 text-[12px]";

export function DecisionForm({ detail }: { detail: ReviewDetail }) {
  const router = useRouter();
  const [mode, setMode] = useState<"APPROVE" | "REQUEST_REVISION">("APPROVE");
  const [rubric, setRubric] = useState<Record<string, number>>({});
  const [score, setScore] = useState<string | null>(null); // null = follow the suggestion
  const [feedback, setFeedback] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const judgement = useMemo(() => rubricJudgement(detail.rubric, rubric), [detail.rubric, rubric]);
  const suggested = useMemo(() => suggestedScore(detail.metrics as SubmissionMetrics | null, detail.scoringCriteria, judgement), [detail.metrics, detail.scoringCriteria, judgement]);
  const shownScore = score ?? (suggested === null ? "" : String(suggested));
  const weight = Math.round((detail.scoringCriteria.reviewerWeight ?? 0.5) * 100);

  const submit = async () => {
    setError(null);
    const body = mode === "APPROVE"
      ? { decision: "APPROVE", score: Number(shownScore), feedback, rubric }
      : { decision: "REQUEST_REVISION", errorTags: tags, feedback, correctionInstructions: instructions, rubric };
    if (mode === "APPROVE" && (shownScore === "" || Number.isNaN(Number(shownScore)) || Number(shownScore) < 0 || Number(shownScore) > 100)) { setError("Enter a score between 0 and 100."); return; }
    if (mode === "REQUEST_REVISION" && (!feedback.trim() || !instructions.trim())) { setError("Feedback and correction instructions are required."); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews/${detail.submission.id}/decide`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Failed (${res.status})`); return; }
      router.push("/review");
      router.refresh();
    } finally { setBusy(false); }
  };

  const d = detail.decision;
  if (!detail.canDecide) {
    return (
      <div className="space-y-2 p-3 text-[12px]" data-testid="decision-summary">
        <h3 className="text-[12px] font-semibold">Decision</h3>
        {d ? (
          <>
            <p><span className="font-medium">{d.decision === "APPROVE" ? "Approved" : "Revision requested"}</span> by {d.reviewerName} on <LocalTime iso={d.createdAt} /></p>
            {d.score !== null && <p>Score: <span className="font-medium">{d.score}</span> / 100</p>}
            {d.tags.length > 0 && <p>Tags: {d.tags.map((t) => detail.reviewerErrorTags.find((x) => x.key === t)?.name ?? t).join(", ")}</p>}
            {d.feedback && <p className="whitespace-pre-wrap rounded border border-line bg-panel p-2">{d.feedback}</p>}
            {d.correctionInstructions && <p className="whitespace-pre-wrap rounded border border-line bg-panel p-2"><span className="font-medium">Correction instructions: </span>{d.correctionInstructions}</p>}
            {Object.keys(d.rubric).length > 0 && (
              <ul>{detail.rubric.filter((r) => d.rubric[r.key] !== undefined).map((r) => <li key={r.key}>{r.name}: {d.rubric[r.key]}</li>)}</ul>
            )}
          </>
        ) : (
          <p className="text-muted">{detail.submission.status === "PENDING_REVIEW" ? "This submission cannot be decided here (it is your own, or no longer the active attempt)." : "No decision recorded."}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 text-[12px]" data-testid="decision-form">
      <h3 className="text-[12px] font-semibold">Decision</h3>
      <div className="flex gap-1" role="tablist">
        {(["APPROVE", "REQUEST_REVISION"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} data-testid={m === "APPROVE" ? "mode-approve" : "mode-revise"}
            className={`h-7 flex-1 rounded border px-2 ${mode === m ? "border-accent bg-accent-tint font-medium" : "border-line bg-surface hover:bg-panel"}`}>
            {m === "APPROVE" ? "Approve" : "Request revision"}
          </button>
        ))}
      </div>

      {detail.rubric.length > 0 && (
        <div>
          <p className="mb-1 font-medium">Rubric scores <span className="font-normal text-muted">(optional; feed the suggested score)</span></p>
          <ul className="space-y-1">
            {detail.rubric.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2">
                <span title={r.description}>{r.name} <span className="text-muted">({r.weight}%)</span></span>
                <select aria-label={`Rubric ${r.name}`} className="h-6 rounded border border-line bg-surface px-1" value={rubric[r.key] ?? ""}
                  onChange={(e) => setRubric((x) => { const n = { ...x }; if (e.target.value === "") delete n[r.key]; else n[r.key] = Number(e.target.value); return n; })}>
                  <option value="">-</option>
                  {r.levels.map((l) => <option key={l.score} value={l.score}>{l.score} {l.label}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "APPROVE" ? (
        <label className="block">
          <span className="mb-0.5 block font-medium">Score (0-100)</span>
          <input type="number" min={0} max={100} step={1} className={`${field} w-24`} value={shownScore} onChange={(e) => setScore(e.target.value)} data-testid="score-input" />
          <span className="mt-1 block text-muted" data-testid="suggested-label">
            {suggested === null ? "No metrics available: no suggestion." : <>Suggested: <span className="font-medium text-ink">{suggested}</span> (metric score {detail.auto.score === null ? "n/a" : Math.round(detail.auto.score)} blended with {judgement === null ? "metrics only, no rubric entered" : `rubric ${Math.round(judgement)}`} at {weight}% reviewer weight). Editable.</>}
            {score !== null && suggested !== null && <> <button type="button" className="underline" onClick={() => setScore(null)}>use suggestion</button></>}
          </span>
        </label>
      ) : (
        <>
          <div>
            <p className="mb-1 font-medium">Error tags</p>
            <div className="flex flex-wrap gap-1">
              {detail.reviewerErrorTags.map((t) => {
                const on = tags.includes(t.key);
                return (
                  <button key={t.key} type="button" title={t.description} aria-pressed={on} onClick={() => setTags((x) => (on ? x.filter((k) => k !== t.key) : [...x, t.key]))}
                    className={`rounded border px-1.5 py-0.5 ${on ? "border-ink bg-ink text-surface" : "border-line bg-surface hover:bg-panel"}`}>{t.name}</button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-0.5 block font-medium">Correction instructions (required)</span>
            <textarea className={`${field} min-h-[64px]`} value={instructions} onChange={(e) => setInstructions(e.target.value)} data-testid="instructions-input" />
          </label>
        </>
      )}
      <label className="block">
        <span className="mb-0.5 block font-medium">Feedback {mode === "REQUEST_REVISION" ? "(required)" : "(optional)"}</span>
        <textarea className={`${field} min-h-[72px]`} value={feedback} onChange={(e) => setFeedback(e.target.value)} data-testid="feedback-input" />
      </label>
      {error && <p role="alert" className="text-danger-ink" data-testid="decision-error">{error}</p>}
      <Button variant="primary" onClick={() => void submit()} disabled={busy} data-testid="submit-decision">{busy ? "Saving..." : mode === "APPROVE" ? "Approve" : "Send back for revision"}</Button>
    </div>
  );
}
