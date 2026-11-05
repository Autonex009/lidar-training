"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { FormState } from "@/app/actions";

export interface AuthField {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
}

export function AuthForm({
  action,
  fields,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fields: AuthField[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {fields.map((f) => (
        <Field key={f.name} large name={f.name} label={f.label} type={f.type ?? "text"} autoComplete={f.autoComplete} required />
      ))}
      {state.error ? (
        <p role="alert" className="rounded-[10px] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[14px] text-danger-ink">{state.error}</p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="mt-1 h-12 w-full text-[16px]">
        {pending ? "Please wait..." : submitLabel}
      </Button>
    </form>
  );
}
