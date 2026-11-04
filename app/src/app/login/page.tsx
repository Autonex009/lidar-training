import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions";

const MESSAGES: Record<string, string> = {
  "session-expired": "Your session no longer matches an account. Please sign in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  if (await getSessionUser()) redirect("/learn");
  const { msg } = await searchParams;
  const notice = msg ? MESSAGES[msg] : undefined;
  return (
    <AuthShell title="Sign in">
      {notice && <p className="mb-4 rounded border border-border bg-panel px-3 py-2 text-[13px] text-ink">{notice}</p>}
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
