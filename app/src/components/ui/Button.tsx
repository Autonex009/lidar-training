import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-white border-accent hover:bg-accent-hover rounded-full",
  secondary: "bg-surface text-ink border-line hover:bg-panel",
  ghost: "bg-transparent text-ink border-transparent hover:bg-panel",
};
const sizes: Record<Size, string> = { md: "h-8 px-3 text-[13px]", lg: "h-10 px-5 text-[14px]" };

const base = "inline-flex items-center justify-center gap-1.5 rounded-[10px] border font-medium disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={`${base} ${sizes[size]} ${styles[variant]} ${className}`} {...props} />;
}

/** A link that looks like a Button. */
export function ButtonLink({ variant = "secondary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={`${base} ${sizes[size]} ${styles[variant]} ${className}`} {...props} />;
}
