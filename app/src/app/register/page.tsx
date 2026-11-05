import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm, type AuthField } from "@/components/AuthForm";
import { registerAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const needsInvite = Boolean((process.env.REGISTRATION_INVITE_CODE ?? "").trim());
  const fields: AuthField[] = [
    { name: "name", label: "Full name", autoComplete: "name" },
    { name: "email", label: "Work email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password (min 8 characters)", type: "password", autoComplete: "new-password" },
  ];
  if (needsInvite) fields.push({ name: "inviteCode", label: "Invite code" });
  const domains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "").split(",").map((d) => d.trim().replace(/^@/, "")).filter(Boolean);
  const rules = [
    domains.length ? `Registration is limited to ${domains.map((d) => "@" + d).join(", ")} email addresses.` : "",
    needsInvite ? "You need an invite code from your administrator." : "",
  ].filter(Boolean);
  return (
    <AuthShell title="Create your account" subtitle="Start learning LiDAR annotation in a few minutes.">
      {rules.length > 0 && (
        <p className="mb-4 rounded-[10px] border border-accent/25 bg-accent-tint px-3 py-2.5 text-[13.5px] leading-snug text-accent">{rules.join(" ")}</p>
      )}
      <AuthForm action={registerAction} submitLabel="Register" fields={fields} />
      <p className="mt-5 text-center text-[14px] text-muted">
        Already registered? <Link className="font-semibold text-accent hover:underline" href="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
