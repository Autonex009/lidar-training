import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { Badge, Section, Table, fmtDate, inputCls, linkCls } from "@/components/admin/ui";
import { UserControls } from "@/components/admin/UserControls";
import { TraineeReviewerPanel } from "@/components/admin/TaskPanels";
import { db } from "@/lib/db";
import { getTimeline, getTraineeDetail } from "@/lib/admin/queries";
import { ACTIVITY_TYPES, activityTypes } from "@/lib/admin/filters";
import { formatSeconds } from "@/lib/admin/stats";

type SP = Promise<{ types?: string | string[]; from?: string; to?: string }>;

export default async function TraineeDetailPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: SP }) {
  const viewer = await requireUser(["ADMIN", "REVIEWER"]);
  const { userId } = await params;
  const sp = await searchParams;
  const d = await getTraineeDetail(userId);
  if (!d) notFound();
  const typesCsv = Array.isArray(sp.types) ? sp.types.join(",") : sp.types;
  const f = activityTypes({ types: typesCsv, from: sp.from, to: sp.to });
  const timeline = await getTimeline(userId, f);
  const reviewers = await db.user.findMany({ where: { role: { in: ["REVIEWER", "ADMIN"] }, passwordHash: { not: { startsWith: "!" } } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const isAdmin = viewer.role === "ADMIN";
  const programName = new Map(d.programs.map((p) => [p.id, p.name]));
  const csvQs = new URLSearchParams();
  for (const t of f.types ?? []) csvQs.append("types", t);
  if (sp.from) csvQs.set("from", sp.from);
  if (sp.to) csvQs.set("to", sp.to);
  const u = d.user;
  return (
    <>
      <PageHeader title={u.name} subtitle={`${u.email} - ${u.role}${isAdmin ? "" : " (read-only view)"}`} />
      <Section title="Profile">
        <div className="text-[13px] leading-6">
          <div>Registered: {fmtDate(u.createdAt)} - Last active: {fmtDate(u.lastActiveAt)}</div>
          <div>Total learning time: <strong>{formatSeconds(d.totalSeconds)}</strong> (heartbeat sessions)</div>
          <div>Certificates: {d.user.certificates.length ? d.user.certificates.map((c) => <Badge key={c.id} tone="ok">{programName.get(c.programId) ?? c.programId} {fmtDate(c.issuedAt)}</Badge>) : "none"}</div>
        </div>
        {isAdmin ? <div className="mt-3"><UserControls userId={u.id} role={u.role} programs={d.programs} enrolledIds={u.enrollments.map((e) => e.programId)} /></div> : null}
      </Section>

      <Section title="Enrollment and gate">
        <Table head={["Program", "Enrolled", "Learn completed", "Program completed", "Annotate / Review / Complete"]} empty={u.enrollments.length ? undefined : "Not enrolled in any program."}>
          {u.enrollments.map((e) => {
            const g = d.gates[e.programId];
            return (
              <tr key={e.id}>
                <td>{e.program.name}</td><td>{fmtDate(e.enrolledAt)}</td><td>{fmtDate(e.learnCompletedAt)}</td><td>{fmtDate(e.programCompletedAt)}</td>
                <td>{g.unlocked.annotate ? <Badge tone="ok">Unlocked</Badge> : <Badge tone="warn">Locked</Badge>}</td>
              </tr>
            );
          })}
        </Table>
      </Section>

      <Section title="Module progress">
        <Table head={["Program", "Module", "Mandatory", "Lessons", "Opened", "Completed", "Quiz passed", "Time"]} empty={d.modules.length ? undefined : "No modules."}>
          {d.modules.map((m) => (
            <tr key={m.id}>
              <td>{programName.get(m.programId)}</td><td>{m.title}</td><td>{m.isMandatory ? "yes" : "optional"}</td>
              <td className="tabular-nums">{m.lessonsDone}/{m.lessons}</td><td>{fmtDate(m.openedAt)}</td><td>{fmtDate(m.completedAt)}</td><td>{fmtDate(m.quizPassedAt)}</td>
              <td className="tabular-nums">{m.seconds ? formatSeconds(m.seconds) : "-"}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Quiz and assessment attempts">
        <Table head={["When", "Type", "Module", "Score", "Result"]} empty={d.attempts.length ? undefined : "No attempts."}>
          {d.attempts.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{fmtDate(a.finishedAt)}</td><td>{a.isFinal ? "Final assessment" : "Module quiz"}</td><td>{a.module?.title ?? "-"}</td>
              <td className="tabular-nums">{a.score}%</td><td>{a.passed ? <Badge tone="ok">Passed</Badge> : <Badge tone="warn">Failed</Badge>}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Assignments">
        {isAdmin ? <TraineeReviewerPanel userId={u.id} reviewers={reviewers} /> : null}
        <Table head={["Task", "Status", "Reviewer", "Attempts", "Scores"]} empty={d.assignments.length ? undefined : "No assignments."}>
          {d.assignments.map((a) => (
            <tr key={a.id}>
              <td><Link href={`/admin/tasks/${a.taskId}`} className={linkCls}>{a.task.code}</Link> {a.task.title}</td>
              <td><StatusBadge status={a.status as Status} /></td>
              <td>{a.reviewer?.name ?? "-"}</td>
              <td className="tabular-nums">{a.submissions.length}</td>
              <td className="tabular-nums">{a.submissions.map((s) => s.decision?.score ?? (s.decision ? "-" : "pending")).join(", ") || "-"}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Activity timeline" actions={<a className={linkCls + " text-[13px]"} href={`/api/admin/trainees/${u.id}/activity.csv?${csvQs.toString()}`}>Export CSV</a>}>
        <form method="get" className="mb-3 flex flex-wrap items-end gap-3 text-[13px]">
          <fieldset className="flex max-w-3xl flex-wrap gap-x-3 gap-y-1">
            <legend className="mb-1 text-muted">Types</legend>
            {ACTIVITY_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1"><input type="checkbox" name="types" value={t} defaultChecked={f.types?.includes(t)} />{t}</label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1"><span className="text-muted">From</span><input type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1"><span className="text-muted">To</span><input type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} /></label>
          <Button type="submit">Filter</Button>
        </form>
        <Table head={["Time (UTC)", "Event", "Entity", "Detail"]} empty={timeline.length ? undefined : "No activity matches."}>
          {timeline.map((e) => (
            <tr key={e.id} data-testid="timeline-row">
              <td className="whitespace-nowrap tabular-nums">{fmtDate(e.at)}</td><td>{e.type}</td><td>{e.entityLabel}</td><td className="text-muted">{e.detail}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
