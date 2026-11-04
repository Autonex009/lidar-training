import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section, Table, Badge, fmtDate, linkCls } from "@/components/admin/ui";
import { UserControls } from "@/components/admin/UserControls";
import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { parseAllowedDomains } from "@/lib/registration";
import Link from "next/link";

export default async function AdminUsersPage() {
  await requireUser(["ADMIN"]);
  const [users, programs] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, include: { enrollments: { select: { programId: true } } } }),
    db.trainingProgram.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const domains = parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS);
  const invite = (process.env.REGISTRATION_INVITE_CODE ?? "").trim();
  return (
    <>
      <PageHeader title="Users" subtitle="Create accounts, change roles, reset passwords and manage enrollment." />
      <Section title="Registration settings (read-only)">
        <div className="text-[13px] leading-6">
          <div>Allowed email domains: {domains.length ? domains.map((d) => <Badge key={d}>{d}</Badge>) : <span className="text-muted">any domain</span>}</div>
          <div>Invite code: {invite ? <Badge tone="ok">required</Badge> : <span className="text-muted">not required</span>}{invite ? <span className="ml-2 text-muted">value hidden; see REGISTRATION_INVITE_CODE</span> : null}</div>
          <div>Default enrollment program: <code>{process.env.DEFAULT_PROGRAM_SLUG?.trim() || "foundations"}</code></div>
          <p className="mt-1 text-muted">These come from environment variables (<code>ALLOWED_EMAIL_DOMAINS</code>, <code>REGISTRATION_INVITE_CODE</code>, <code>DEFAULT_PROGRAM_SLUG</code>) in <code>.env</code> or your hosting settings. Change them there and restart the server; they cannot be edited here. Admin-created users bypass these checks.</p>
        </div>
      </Section>
      <Section title="Create user"><CreateUserForm /></Section>
      <Section title={`All users (${users.length})`}>
        <Table head={["Name", "Email", "Role", "Created", "Controls"]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td><Link className={linkCls} href={`/admin/trainees/${u.id}`}>{u.name}</Link></td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td className="whitespace-nowrap">{fmtDate(u.createdAt)}</td>
              <td><UserControls userId={u.id} role={u.role} programs={programs} enrolledIds={u.enrollments.map((e) => e.programId)} /></td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
