import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "@/components/AuthForm";
import { setupAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await db.user.count({ where: { role: "ADMIN" } })) > 0) notFound();
  return (
    <AuthShell title="Initial administrator setup" subtitle="Create the first administrator. Requires the SETUP_TOKEN from the server environment.">
      <AuthForm
        action={setupAction}
        submitLabel="Create admin"
        fields={[
          { name: "setupToken", label: "Setup token", type: "password" },
          { name: "name", label: "Full name", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password (min 8 characters)", type: "password", autoComplete: "new-password" },
        ]}
      />
    </AuthShell>
  );
}
