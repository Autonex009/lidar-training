import Link from "next/link";
import { requireSection } from "@/lib/guard";
import { getUserEnrollment } from "@/lib/enroll";
import { ensureAssignments } from "@/lib/tasks/assignments";
import { listTaskRows, type TaskRow } from "@/lib/tasks/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, difficultyTone } from "@/components/ui/Chip";
import { UIcon, type IconName } from "@/components/ui/Icons";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: "Inspection", IDENTIFICATION: "Identification", CUBOID: "Cuboid", SEMANTIC_SEG: "Semantic segmentation",
  INSTANCE_SEG: "Instance segmentation", TRACKING: "Tracking", ERROR_DETECTION: "Error detection", MIXED: "Mixed",
};
const TYPE_ICON: Record<string, IconName> = {
  INSPECTION: "eye", IDENTIFICATION: "target", CUBOID: "cube", SEMANTIC_SEG: "paint", INSTANCE_SEG: "layers", TRACKING: "route", ERROR_DETECTION: "flag", MIXED: "scan",
};
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const OPEN_STATES = new Set(["NOT_STARTED", "IN_PROGRESS", "REVISION_REQUIRED"]);

function actionLabel(r: TaskRow) {
  return r.status === "NOT_STARTED" ? "Start" : r.status === "PENDING_REVIEW" || r.status === "APPROVED" ? "View" : "Open";
}

function TaskCard({ r }: { r: TaskRow }) {
  return (
    <li
      className={`rounded-xl border bg-surface p-5 ${r.locked ? "border-line bg-panel/60" : r.status === "REVISION_REQUIRED" ? "border-warning/50" : "border-line"}`}
      data-testid={`task-row-${r.code}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${r.locked ? "bg-panel text-muted" : "bg-accent-tint text-accent"}`}>
          <UIcon name={r.locked ? "lock" : TYPE_ICON[r.annotationType] ?? "cube"} size={22} />
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{r.code}</span>
            <span className={`text-[16px] font-semibold ${r.locked ? "text-muted" : "text-ink"}`}>{r.title}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone={difficultyTone(r.difficulty)}>{cap(r.difficulty)}</Chip>
            <Chip>{TYPE_LABEL[r.annotationType] ?? r.annotationType}</Chip>
            <Chip icon="clock">{r.estimatedMinutes} min</Chip>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {r.locked ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-panel px-2.5 text-[12px] font-medium text-muted" title={r.lockReason}><UIcon name="lock" size={12} />Locked</span>
          ) : <StatusBadge status={r.status as Status} />}
          {r.locked ? null : (
            <ButtonLink href={`/annotate/${r.assignmentId}`} variant={r.status === "PENDING_REVIEW" || r.status === "APPROVED" ? "secondary" : "primary"} className="min-w-20">{actionLabel(r)}</ButtonLink>
          )}
        </div>
      </div>
      {r.locked && r.lockReason ? (
        <p className="mt-3 flex items-center gap-1.5 text-[14px] text-muted"><UIcon name="lock" size={13} />{r.lockReason}</p>
      ) : null}
      {r.feedbackSnippet ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[14px] text-body">
          <UIcon name="review" size={15} className="mt-0.5 text-warning-ink" />
          <span><b className="font-semibold text-warning-ink">Reviewer feedback: </b>{r.feedbackSnippet}</span>
        </p>
      ) : null}
    </li>
  );
}

function NextUp({ r }: { r: TaskRow }) {
  return (
    <section aria-label="Next up" className="mb-8 rounded-xl border border-line bg-surface p-6 shadow-float">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-accent">Next up</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent"><UIcon name={TYPE_ICON[r.annotationType] ?? "cube"} size={26} /></span>
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="text-[20px] font-bold leading-7 tracking-tight text-ink"><span className="text-muted">{r.code}</span> {r.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone={difficultyTone(r.difficulty)}>{cap(r.difficulty)}</Chip>
            <Chip>{TYPE_LABEL[r.annotationType] ?? r.annotationType}</Chip>
            <Chip icon="clock">About {r.estimatedMinutes} min</Chip>
            {r.status === "REVISION_REQUIRED" ? <StatusBadge status="REVISION_REQUIRED" /> : null}
          </div>
          {r.feedbackSnippet ? <p className="mt-2 text-[14px] text-muted">{r.feedbackSnippet}</p> : null}
        </div>
        <ButtonLink href={`/annotate/${r.assignmentId}`} variant="primary" size="lg">{r.status === "NOT_STARTED" ? "Start" : "Continue"}<UIcon name="arrow" size={16} /></ButtonLink>
      </div>
    </section>
  );
}

export default async function AnnotatePage() {
  const user = await requireSection("annotate");
  const enrollment = await getUserEnrollment(user.id);
  const rows = enrollment ? (await ensureAssignments(user.id, enrollment.programId), await listTaskRows(user.id, enrollment.programId, user.role)) : [];
  const core = rows.filter((r) => !r.trackKey);
  const optional = rows.filter((r) => r.trackKey);
  const next = core.find((r) => !r.locked && OPEN_STATES.has(r.status));
  const approved = core.filter((r) => r.status === "APPROVED").length;
  return (
    <>
      <PageHeader
        title="Annotate"
        subtitle={enrollment ? enrollment.program.name : "Annotation tasks"}
        chips={core.length ? <><Chip tone="success" icon="check">{approved} of {core.length} approved</Chip><Chip icon="review">{core.filter((r) => r.status === "PENDING_REVIEW").length} in review</Chip></> : null}
        action={<Link href="/review" className="text-[14px] font-medium text-accent hover:underline">My submissions</Link>}
      />
      {rows.length === 0 ? (
        <EmptyState variant="checklist" title="No tasks assigned yet" description="Tasks appear here once your program has published tasks." />
      ) : (
        <>
          {next ? <NextUp r={next} /> : null}
          <h2 className="mb-3 text-[16px] font-semibold text-ink">All tasks</h2>
          <ul className="space-y-3">{core.map((r) => <TaskCard key={r.assignmentId} r={r} />)}</ul>
          {optional.length > 0 && (
            <>
              <h2 className="mb-1 mt-8 text-[16px] font-semibold text-ink">Optional tracks</h2>
              <p className="mb-3 text-[14px] text-muted">Extra practice, not required for the certificate.</p>
              <ul className="space-y-3">{optional.map((r) => <TaskCard key={r.assignmentId} r={r} />)}</ul>
            </>
          )}
        </>
      )}
    </>
  );
}
