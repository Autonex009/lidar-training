"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { LocalTime } from "@/components/ui/LocalTime";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import type { MySubmissionRow } from "@/lib/review/service";

const th = "border-b border-line px-2 py-1.5 text-left font-medium";
const td = "border-b border-line px-2 py-2 align-top";

export function TraineeSubmissions({ rows }: { rows: MySubmissionRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="w-full border border-line text-[13px]" data-testid="my-submissions">
      <thead className="bg-panel text-[12px] text-muted">
        <tr>{["", "Task", "Attempt", "Submitted", "Status", "Reviewer", "Score", "Feedback"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isOpen = open === r.submissionId;
          return (
            <Fragment key={r.submissionId}>
              <tr data-testid={`my-sub-${r.code}-${r.attempt}`}>
                <td className={td}><button type="button" aria-expanded={isOpen} aria-label={isOpen ? "Collapse" : "Expand"} className="h-5 w-5 rounded border border-line text-[11px] hover:bg-panel" onClick={() => setOpen(isOpen ? null : r.submissionId)}>{isOpen ? "-" : "+"}</button></td>
                <td className={td}><span className="font-medium">{r.code}</span> {r.title}</td>
                <td className={`${td} tabular-nums`}>{r.attempt}</td>
                <td className={td}><LocalTime iso={r.submittedAt} /></td>
                <td className={td}><StatusBadge status={r.status as Status} /></td>
                <td className={td}>{r.reviewerName ?? <span className="text-muted">Not yet assigned</span>}</td>
                <td className={`${td} tabular-nums`}>{r.score ?? "-"}</td>
                <td className={`${td} max-w-[280px] text-[12px] text-muted`}>{r.feedback ? (r.feedback.length > 110 ? `${r.feedback.slice(0, 107)}...` : r.feedback) : r.status === "PENDING_REVIEW" ? "Waiting for a reviewer" : "-"}</td>
              </tr>
              {isOpen && (
                <tr data-testid="my-sub-detail">
                  <td className="border-b border-line bg-panel" />
                  <td colSpan={7} className="border-b border-line bg-panel px-2 py-2 text-[12px]">
                    {r.feedback && <p className="mb-1 whitespace-pre-wrap"><span className="font-medium">Feedback: </span>{r.feedback}</p>}
                    {r.tags.length > 0 && <p className="mb-1"><span className="font-medium">Error tags: </span>{r.tags.join(", ")}</p>}
                    {r.correctionInstructions && <p className="mb-1 whitespace-pre-wrap"><span className="font-medium">Correction instructions: </span>{r.correctionInstructions}</p>}
                    <p className="mb-1"><span className="font-medium">Version history: </span>{r.history.map((h) => `#${h.attempt} ${h.status.replace("_", " ").toLowerCase()}${h.score !== null ? ` (${h.score})` : ""}`).join(" / ")}</p>
                    {r.canReopen && <Link href={`/annotate/${r.assignmentId}`} className="inline-flex h-7 items-center rounded-full border border-accent bg-accent text-white px-3 font-medium hover:bg-accent-hover">Reopen task to revise</Link>}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
