import type { InputHTMLAttributes } from "react";

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className="text-muted">{label}</span>
      <input
        className="h-9 rounded-md border border-line bg-surface px-2.5 text-ink outline-none focus:border-ink"
        {...props}
      />
    </label>
  );
}
