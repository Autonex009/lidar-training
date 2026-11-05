import type { ReactNode } from "react";
import { UIcon, type IconName } from "./Icons";

type Tone = "plain" | "primary" | "success" | "warning" | "danger";
const TONES: Record<Tone, string> = {
  plain: "border-line bg-panel text-body",
  primary: "border-accent/25 bg-accent-tint text-accent",
  success: "border-success/30 bg-success/10 text-success-ink",
  warning: "border-warning/40 bg-warning/10 text-warning-ink",
  danger: "border-danger/30 bg-danger/10 text-danger-ink",
};

/** Small rounded meta chip (12px). */
export function Chip({ tone = "plain", icon, children, className = "" }: { tone?: Tone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium ${TONES[tone]} ${className}`}>
      {icon ? <UIcon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export const difficultyTone = (d: string): Tone => (d === "BEGINNER" ? "success" : d === "INTERMEDIATE" ? "warning" : d === "ADVANCED" ? "danger" : "plain");
