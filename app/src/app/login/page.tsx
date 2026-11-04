import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/learn");
  return (
    <AuthShell title="Sign in">
      <AuthForm
        action={loginAction}
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="mt-4 text-[13px] text-muted">
        No account? <Link className="text-ink underline" href="/register">Register</Link>
      </p>
    </AuthShell>
  );
}
