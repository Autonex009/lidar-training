"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Labeled, Status, useOp } from "./client";
import { areaCls, inputCls } from "./ui";

export interface QuestionValue { id?: string; kind: string; prompt: string; options: string[]; correctAnswer: number | boolean; explanation: string }
const KINDS = ["MULTIPLE_CHOICE", "TRUE_FALSE", "INTERPRETATION", "IDENTIFY_INCORRECT", "CHOOSE_DECISION", "IDENTIFY_OBJECT"];
const blank = (): QuestionValue => ({ kind: "MULTIPLE_CHOICE", prompt: "", options: ["", ""], correctAnswer: 0, explanation: "" });

function QuestionForm({ programId, moduleId, initial, onDone }: { programId: string; moduleId: string | null; initial: QuestionValue; onDone?: () => void }) {
  const o = useOp();
  const [q, setQ] = useState(initial);
  const isTF = q.kind === "TRUE_FALSE";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <Labeled label="Kind">
          <select className={inputCls} value={q.kind} onChange={(e) => { const k = e.target.value; setQ({ ...q, kind: k, correctAnswer: k === "TRUE_FALSE" ? true : 0, options: k === "TRUE_FALSE" ? [] : q.options.length >= 2 ? q.options : ["", ""] }); }}>
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </Labeled>
        <div className="md:col-span-3"><Labeled label="Prompt"><textarea rows={2} className={areaCls + " font-sans text-[13px]"} value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} /></Labeled></div>
      </div>
      {isTF ? (
        <Labeled label="Correct answer"><select className={inputCls} value={String(q.correctAnswer)} onChange={(e) => setQ({ ...q, correctAnswer: e.target.value === "true" })}><option value="true">True</option><option value="false">False</option></select></Labeled>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">Options (select the correct one)</span>
          {q.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" aria-label={`Correct option ${i + 1}`} checked={q.correctAnswer === i} onChange={() => setQ({ ...q, correctAnswer: i })} />
              <input className={`${inputCls} flex-1`} value={opt} onChange={(e) => setQ({ ...q, options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
              <Button variant="ghost" disabled={q.options.length <= 2} onClick={() => setQ({ ...q, options: q.options.filter((_, j) => j !== i), correctAnswer: typeof q.correctAnswer === "number" && q.correctAnswer >= q.options.length - 1 ? 0 : q.correctAnswer })}>Remove</Button>
            </div>
          ))}
          <div><Button onClick={() => setQ({ ...q, options: [...q.options, ""] })}>Add option</Button></div>
        </div>
      )}
      <Labeled label="Explanation"><textarea rows={2} className={areaCls + " font-sans text-[13px]"} value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} /></Labeled>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={o.pending} onClick={async () => { const r = await o.run("question.save", { ...q, programId, moduleId }, { ok: () => "Saved." }); if (r.ok && !q.id) { setQ(blank()); onDone?.(); } }}>{q.id ? "Save question" : "Add question"}</Button>
        {q.id ? <Button disabled={o.pending} onClick={() => { if (window.confirm("Delete this question?")) void o.run("question.delete", { id: q.id }); }}>Delete</Button> : null}
        <Status error={o.error} message={o.message} />
      </div>
    </div>
  );
}

export function QuizEditor({ programId, moduleId, questions }: { programId: string; moduleId: string | null; questions: QuestionValue[] }) {
  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <p className="text-[13px] text-muted">Editing here changes the live quiz. Re-importing the program from its source overwrites questions with the authored content.</p>
      {questions.map((q, i) => (
        <div key={q.id}>
          <div className="mb-1 text-[12px] text-muted">Question {i + 1}</div>
          <QuestionForm programId={programId} moduleId={moduleId} initial={q} />
        </div>
      ))}
      <div>
        <div className="mb-1 text-[12px] font-medium">New question</div>
        <QuestionForm programId={programId} moduleId={moduleId} initial={blank()} />
      </div>
    </div>
  );
}
