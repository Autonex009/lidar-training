import type { InputHTMLAttributes } from "react";

export function Field({ label, large = false, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; large?: boolean }) {
  return (
    <label className={`flex flex-col ${large ? "gap-2 text-[15px]" : "gap-1 text-[13px]"}`}>
      <span className={large ? "font-medium text-ink" : "text-muted"}>{label}</span>
      <input
        className={`rounded-[10px] border border-line bg-surface text-ink outline-none focus:border-accent focus:ring-[3px] focus:ring-[var(--ring)] ${large ? "h-12 px-4 text-[16px]" : "h-9 px-2.5"}`}
        {...props}
      />
    </label>
  );
}
