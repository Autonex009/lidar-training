import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm, type AuthField } from "@/components/AuthForm";
import { registerAction } from "@/app/actions";

export default function RegisterPage() {
  const needsInvite = Boolean((process.env.REGISTRATION_INVITE_CODE ?? "").trim());
  const fields: AuthField[] = [
    { name: "name", label: "Full name", autoComplete: "name" },
    { name: "email", label: "Work email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password (min 8 characters)", type: "password", autoComplete: "new-password" },
  ];
  if (needsInvite) fields.push({ name: "inviteCode", label: "Invite code" });
  return (
    <AuthShell title="Create account">
      <AuthForm action={registerAction} submitLabel="Register" fields={fields} />
      <p className="mt-4 text-[13px] text-muted">
        Already registered? <Link className="text-ink underline" href="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
