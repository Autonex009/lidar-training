import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, Wordmark } from "@/components/Brand";

const POINTS = [
  { icon: "book", text: "Short lessons on point-cloud fundamentals, with interactive checkpoints." },
  { icon: "cube", text: "Practise cuboid and segmentation tasks on synthetic 3D scenes." },
  { icon: "shield", text: "Expert review on every submission, then a certificate when you pass." },
] as const;

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="dot-grid min-h-screen text-[16px]">
      <div className="mx-auto grid min-h-screen max-w-[1200px] grid-rows-[auto_1fr] px-6">
        <header className="flex h-20 items-center">
          <Link href="/" className="text-[19px]"><Wordmark /></Link>
        </header>
        <div className="grid items-center gap-10 pb-12 min-[900px]:grid-cols-[55fr_45fr] min-[900px]:gap-16 min-[900px]:pb-20">
          <section>
            <h2 className="text-[clamp(40px,4.5vw,64px)] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink">
              Learn LiDAR annotation.<br />
              <span className="grad-text">Train for real 3D projects.</span>
            </h2>
            <ul className="mt-10 hidden flex-col gap-5 min-[900px]:flex">
              {POINTS.map((p) => (
                <li key={p.icon} className="flex max-w-[520px] items-start gap-4 text-[17px] leading-snug text-body">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent"><Icon name={p.icon} size={20} /></span>
                  <span className="pt-2">{p.text}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="min-[900px]:justify-self-end w-full max-w-[480px]">
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-float min-[900px]:p-10">
              <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-ink">{title}</h1>
              {subtitle ? <p className="mt-2 text-[15px] leading-snug text-muted">{subtitle}</p> : null}
              <div className="mt-7">{children}</div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
