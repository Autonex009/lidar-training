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
    <form action={formAction} className="flex flex-col gap-3">
      {fields.map((f) => (
        <Field key={f.name} name={f.name} label={f.label} type={f.type ?? "text"} autoComplete={f.autoComplete} required />
      ))}
      {state.error ? <p role="alert" className="text-[13px] text-red-600">{state.error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending} className="h-9">
        {pending ? "Please wait..." : submitLabel}
      </Button>
    </form>
  );
}
