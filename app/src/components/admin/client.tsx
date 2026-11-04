"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export type CallResult<T = Record<string, unknown>> = { ok: true; data: T } | { ok: false; error: string };

export async function callOp<T = Record<string, unknown>>(name: string, input: unknown): Promise<CallResult<T>> {
  try {
    const res = await fetch(`/api/admin/op/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const body = (await res.json()) as { ok: boolean; data?: T; error?: string };
    return body.ok ? { ok: true, data: body.data as T } : { ok: false, error: body.error ?? `Request failed (${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Runs an admin op, tracks pending/error/message, and refreshes server data on success. */
export function useOp() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run<T = Record<string, unknown>>(name: string, input: unknown, opts?: { ok?: (d: T) => string | void; navigate?: (d: T) => string }): Promise<CallResult<T>> {
    setBusy(true); setError(null); setMessage(null);
    const r = await callOp<T>(name, input);
    setBusy(false);
    if (!r.ok) { setError(r.error); return r; }
    setMessage((opts?.ok?.(r.data) as string | undefined) ?? "Saved.");
    if (opts?.navigate) router.push(opts.navigate(r.data));
    start(() => router.refresh());
    return r;
  }
  return { run, pending: pending || busy, error, message, setError, setMessage };
}

export function Status({ error, message }: { error: string | null; message: string | null }) {
  if (error) return <p role="alert" className="text-[13px] text-red-700">{error}</p>;
  if (message) return <p className="text-[13px] text-green-700">{message}</p>;
  return null;
}

export function OpButton({ op, input, label, confirm, variant, navigate, onResult, disabled }: {
  op: string; input: unknown; label: string; confirm?: string; variant?: "primary" | "secondary" | "ghost";
  navigate?: (d: Record<string, unknown>) => string; onResult?: (d: Record<string, unknown>) => string | void; disabled?: boolean;
}) {
  const o = useOp();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant={variant} disabled={o.pending || disabled} onClick={() => { if (confirm && !window.confirm(confirm)) return; void o.run(op, input, { navigate, ok: onResult ?? ((d) => (Array.isArray(d?.notes) ? (d.notes as string[]).join(" ") : undefined)) }); }}>
        {o.pending ? "Working..." : label}
      </Button>
      <Status error={o.error} message={o.message} />
    </span>
  );
}

export function Labeled({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className="text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

export const linesToArray = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
export const arrayToLines = (a: unknown) => (Array.isArray(a) ? (a as string[]).join("\n") : "");
