"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { LocalTime } from "@/components/ui/LocalTime";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { matchBoxes } from "@/lib/annotation/metrics";
import { cuboidsOf } from "@/lib/annotation/types";
import { describeMetrics } from "@/lib/review/scoring";
import type { ReviewDetail } from "@/lib/review/service";
import { DecisionForm } from "./DecisionForm";
import { ReadOnlyAnnotationViewer } from "./ReadOnlyAnnotationViewer";

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-line px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between"><h3 className="text-[12px] font-semibold">{title}</h3>{right}</div>
      {children}
    </section>
  );
}
const th = "border-b border-line px-1.5 py-1 text-left font-medium text-muted";
const td = "border-b border-line px-1.5 py-1 align-top";

export function ReviewWorkspace({ detail, currentUserId }: { detail: ReviewDetail; currentUserId: string }) {
  const router = useRouter();
  const { task, document: doc, reference } = detail;
  const [showRef, setShowRef] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [assignErr, setAssignErr] = useState<string | null>(null);

  const cubs = cuboidsOf(doc, frame);
  const refList = useMemo(() => (reference ? (reference.frames?.length ? reference.frames.find((f) => f.index === frame)?.cuboids ?? [] : frame === 0 ? reference.cuboids : []) : []), [reference, frame]);
  const match = useMemo(() => {
    const m = matchBoxes(refList, cubs);
    const out = new Map<string, { ref: (typeof refList)[number]; iou: number; centerErr: number }>();
    for (const p of m.pairs) {
      const r = refList[p.ref], c = cubs[p.cand];
      out.set(c.id, { ref: r, iou: p.iou, centerErr: Math.hypot(r.center[0] - c.center[0], r.center[1] - c.center[1], r.center[2] - c.center[2]) });
    }
    return out;
  }, [refList, cubs]);
  const selected = cubs.find((c) => c.id === selectedId) ?? null;
  const sm = selected ? match.get(selected.id) : undefined;
  const metricRows = useMemo(() => describeMetrics(detail.metrics), [detail.metrics]);
  const isSeg = task.annotationType === "SEMANTIC_SEG" || task.annotationType === "INSTANCE_SEG";
  const tagName = (k: string) => task.errorTags.find((t) => t.key === k)?.name ?? k;
  const hasErrorSection = task.annotationType === "ERROR_DETECTION" || detail.plantedErrors.length > 0 || (doc.errorsFound?.length ?? 0) > 0;

  const assignToMe = async () => {
    setAssignErr(null);
    const res = await fetch("/api/reviews/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: detail.submission.id }) });
    if (!res.ok) setAssignErr(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed");
    else router.refresh();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface text-[13px]" data-testid="review-workspace">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3">
        <Link href="/review" className="text-[12px] text-muted underline">Review queue</Link>
        <span className="font-semibold">{task.code}</span>
        <span className="truncate">{task.title}</span>
        <span className="text-muted">/ {detail.trainee.name} / attempt {detail.submission.attempt}</span>
        <StatusBadge status={detail.submission.status as Status} />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[12px] text-muted">Reviewer: {detail.reviewer?.name ?? "unassigned"}</span>
          {detail.reviewer?.id !== currentUserId && <Button onClick={() => void assignToMe()} data-testid="assign-me">Assign to me</Button>}
          {assignErr && <span className="text-[12px] text-red-700">{assignErr}</span>}
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px]">
            <input type="checkbox" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} data-testid="toggle-reference" />
            Show reference <span className="text-muted">{isSeg ? "(point labels)" : "(dashed white boxes)"}</span>
          </label>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-[340px] shrink-0 overflow-y-auto border-r border-line" data-testid="review-left">
          <Section title="Submission">
            <dl className="grid grid-cols-[84px_1fr] gap-y-0.5 text-[12px]">
              <dt className="text-muted">Trainee</dt><dd>{detail.trainee.name} <span className="text-muted">{detail.trainee.email}</span></dd>
              <dt className="text-muted">Task</dt><dd>{task.code} - {task.title}</dd>
              <dt className="text-muted">Program</dt><dd>{detail.programName}</dd>
              <dt className="text-muted">Submitted</dt><dd><LocalTime iso={detail.submission.submittedAt} /></dd>
              <dt className="text-muted">Version</dt><dd>v{detail.submission.versionNumber} (immutable)</dd>
            </dl>
          </Section>
          <Section title="Attempt history">
            <table className="w-full text-[12px]" data-testid="history-table">
              <thead><tr><th className={th}>#</th><th className={th}>Submitted</th><th className={th}>Result</th><th className={th}>Score</th></tr></thead>
              <tbody>
                {detail.versions.map((v) => {
                  const current = v.submissionId === detail.submission.id;
                  return (
                    <tr key={v.versionNumber} className={current ? "bg-accent-tint" : ""}>
                      <td className={td}>{v.submissionId && !current ? <Link href={`/review/${v.submissionId}`} className="underline">v{v.versionNumber}</Link> : `v${v.versionNumber}`}</td>
                      <td className={td}><LocalTime iso={v.submittedAt} date /></td>
                      <td className={td}>{v.status ? <StatusBadge status={v.status as Status} /> : "-"}</td>
                      <td className={`${td} tabular-nums`}>{v.score ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detail.versions.filter((v) => v.feedback).map((v) => <p key={v.versionNumber} className="mt-1 text-[11px] text-muted">v{v.versionNumber}: {v.feedback}</p>)}
          </Section>
          <Section title="Advisory metrics" right={<span className="text-[11px] text-muted">auto, not a score</span>}>
            {metricRows.length === 0 ? <p className="text-[12px] text-muted">No metrics recorded.</p> : (
              <table className="w-full text-[12px]" data-testid="metrics-table">
                <tbody>
                  {metricRows.map((r) => (
                    <tr key={r.label}><td className={td}>{r.label}</td><td className={`${td} whitespace-nowrap tabular-nums font-medium`}>{r.value}</td><td className={`${td} text-muted`}>{r.note}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
          {task.annotationType !== "SEMANTIC_SEG" && task.annotationType !== "INSTANCE_SEG" && (
            <Section title={`Objects (frame ${frame + 1}): ${cubs.length}`}>
              <ul className="space-y-0.5" data-testid="objects-list">
                {cubs.map((c) => {
                  const m = match.get(c.id);
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => setSelectedId(c.id === selectedId ? null : c.id)} className={`flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-[12px] ${c.id === selectedId ? "bg-accent-tint" : "hover:bg-panel"}`}>
                        <span>{c.label}{c.trackId !== undefined ? ` #${c.trackId}` : ""}</span>
                        <span className="text-muted">{m ? `IoU ${m.iou.toFixed(2)}` : "no match"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {selected && (
                <div className="mt-1 rounded border border-line bg-panel p-2 text-[12px]" data-testid="object-detail">
                  <p className="font-medium">{selected.label} {selected.id}</p>
                  {Object.keys(selected.attributes).length > 0 && <p className="text-muted">{Object.entries(selected.attributes).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>}
                  {sm ? (
                    <p>Matched reference: <span className="font-medium">{sm.ref.label}</span> ({sm.ref.id}), IoU {sm.iou.toFixed(2)}, center error {sm.centerErr.toFixed(2)} m{sm.ref.label === selected.label ? ", same class" : ", DIFFERENT class"}</p>
                  ) : <p>No overlapping reference object (extra or misplaced box).</p>}
                </div>
              )}
            </Section>
          )}
          {doc.flags.length > 0 && (
            <Section title={`Trainee flags (${doc.flags.length})`}>
              <ul className="space-y-1 text-[12px]">{doc.flags.map((f) => <li key={f.id} className="rounded border border-line px-1.5 py-1">{f.cuboidId ? `Box ${f.cuboidId}` : "Location"}{f.frame !== undefined ? `, frame ${f.frame + 1}` : ""}: {f.reason}</li>)}</ul>
            </Section>
          )}
          {(task.checkpoints.length > 0 || task.questions.length > 0) && (
            <Section title="Inspection checkpoints and answers">
              <ul className="mb-1 space-y-0.5 text-[12px]">
                {task.checkpoints.map((c) => <li key={c.key}>{doc.checkpoints[c.key] ? "[x]" : "[ ]"} {c.label}</li>)}
              </ul>
              <ol className="space-y-1.5 text-[12px]">
                {task.questions.map((q) => (
                  <li key={q.key}><span className="font-medium">{q.prompt}</span><span className="block whitespace-pre-wrap rounded border border-line bg-panel px-1.5 py-1">{String(doc.answers[q.key] ?? "") || <span className="text-muted">(no answer)</span>}</span></li>
                ))}
              </ol>
            </Section>
          )}
          {hasErrorSection && (
            <Section title="Reported vs planted errors">
              <div className="grid grid-cols-2 gap-2 text-[12px]" data-testid="errors-compare">
                <div>
                  <p className="mb-0.5 font-medium">Reported by trainee ({doc.errorsFound?.length ?? 0})</p>
                  <ul className="space-y-1">{(doc.errorsFound ?? []).map((e) => <li key={e.id} className="rounded border border-line px-1.5 py-1"><span className="font-medium">{tagName(e.tag)}</span> {e.targetAnnotationId ? `on ${e.targetAnnotationId}` : "(missing object)"}<span className="block text-muted">{e.explanation}</span></li>)}</ul>
                </div>
                <div>
                  <p className="mb-0.5 font-medium">Planted ({detail.plantedErrors.length})</p>
                  <ul className="space-y-1">{detail.plantedErrors.map((p, i) => <li key={i} className="rounded border border-line px-1.5 py-1"><span className="font-medium">{p.type.replace(/_/g, " ")}</span> on {p.cuboidId}{p.description ? <span className="block text-muted">{p.description}</span> : null}</li>)}</ul>
                </div>
              </div>
            </Section>
          )}
          {detail.rubric.length > 0 && (
            <Section title="Rubric">
              <ul className="space-y-1.5 text-[12px]" data-testid="rubric">
                {detail.rubric.map((r) => (
                  <li key={r.key}>
                    <p className="font-medium">{r.name} <span className="font-normal text-muted">({r.weight}%)</span></p>
                    <p className="text-muted">{r.description}</p>
                    <ul className="ml-2">{r.levels.map((l) => <li key={l.score}><span className="tabular-nums">{l.score}</span> {l.label}: <span className="text-muted">{l.description}</span></li>)}</ul>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
        <main className="relative min-w-0 flex-1">
          <ReadOnlyAnnotationViewer task={task} document={doc} reference={reference} showReference={showRef} selectedId={selectedId} frame={frame} onSelect={setSelectedId} onFrameChange={setFrame} />
        </main>
        <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-line" data-testid="review-right">
          <DecisionForm key={detail.submission.id} detail={detail} />
        </aside>
      </div>
    </div>
  );
}
