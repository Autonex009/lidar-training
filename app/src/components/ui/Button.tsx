import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-white border-accent hover:bg-accent-hover rounded-full",
  secondary: "bg-surface text-ink border-line hover:bg-panel",
  ghost: "bg-transparent text-ink border-transparent hover:bg-panel",
};

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
