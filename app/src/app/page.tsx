import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { defaultProgramSlug } from "@/lib/enroll";
import { Icon, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", title: "Learn", text: "Work through short lessons on point clouds, coordinate frames and the cuboid rules.", icon: "book" },
  { n: "02", title: "Annotate", text: "Practise on synthetic 3D scenes with the same tools you will use on real data.", icon: "cube" },
  { n: "03", title: "Review", text: "An expert reviews every submission and sends it back with notes until it is right.", icon: "target" },
  { n: "04", title: "Complete", text: "Pass the programme requirements and receive your certificate.", icon: "check" },
] as const;

const pill = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors";
const primary = `${pill} bg-accent text-white hover:bg-accent-hover`;
const outline = `${pill} border border-line bg-surface text-ink hover:bg-panel`;

async function loadStats() {
  const program =
    (await db.trainingProgram.findFirst({ where: { slug: defaultProgramSlug(), isActive: true } })) ??
    (await db.trainingProgram.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
  const [modules, tasks, certified] = await Promise.all([
    program ? db.module.findMany({ where: { programId: program.id, isMandatory: true }, orderBy: { order: "asc" }, select: { id: true, title: true } }) : Promise.resolve([]),
    program ? db.taskTemplate.count({ where: { programId: program.id, isPublished: true } }) : Promise.resolve(0),
    db.certificate.count(),
  ]);
  return { modules, tasks, certified };
}

export default async function Home() {
  if (await getSessionUser()) redirect("/learn");
  const { modules, tasks, certified } = await loadStats();
  const stats = [
    { value: modules.length, label: "Core modules in the programme" },
    { value: tasks, label: "Practice tasks published" },
    { value: certified, label: "Trainees certified" },
  ];

  return (
    <div className="dot-grid min-h-screen text-[15px] text-body">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5">
          <Link href="/" className="whitespace-nowrap text-[15px] sm:text-[17px]"><Wordmark /></Link>
          <nav aria-label="Sections" className="hidden items-center gap-1 rounded-full border border-line bg-surface p-1 text-[14px] font-medium md:flex">
            <a href="#how-it-works" className="rounded-full px-4 py-1.5 hover:bg-panel">How it works</a>
            <a href="#curriculum" className="rounded-full px-4 py-1.5 hover:bg-panel">Curriculum</a>
            <a href="#reviewers" className="rounded-full px-4 py-1.5 hover:bg-panel">For reviewers</a>
          </nav>
          <div className="flex items-center gap-1 text-[14px] sm:gap-2">
            <Link href="/login" className={`${pill} h-10 whitespace-nowrap px-3 text-ink hover:bg-surface sm:px-4`}>Sign in</Link>
            <Link href="/register" className={`${primary} h-10 whitespace-nowrap px-4 sm:px-5`}>Get started</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-14 pt-14 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            <span className="inline-flex items-center rounded-full border border-accent/25 bg-accent-tint px-3.5 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-accent">Internal training portal</span>
            <h1 className="mt-6 text-[clamp(44px,5.5vw,80px)] font-extrabold leading-[1.02] tracking-[-0.045em] text-ink">
              Learn LiDAR.<br />
              <span className="grad-text">Annotate in 3D.</span><br />
              Work on real projects.
            </h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-body">
              Learn point-cloud fundamentals in short interactive lessons, then practise on synthetic 3D scenes.
              Every submission gets expert review, and passing the programme earns you a certificate.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={`${primary} h-12 px-7 text-[16px]`}>Get started <Icon name="arrow" size={18} /></Link>
              <Link href="/login" className={`${outline} h-12 px-7 text-[16px]`}>Sign in</Link>
            </div>
          </div>

          <div className="relative mx-auto h-[380px] w-full max-w-[460px]" aria-label="The four-stage journey">
            <div aria-hidden className="absolute inset-x-8 top-0 h-[300px] rounded-2xl border border-line bg-surface/60" />
            <div aria-hidden className="absolute inset-x-4 top-4 h-[300px] rounded-2xl border border-line bg-surface/80" />
            <div className="absolute inset-x-0 top-9 rounded-2xl border border-line bg-surface p-6 shadow-float">
              <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
                <span>Your journey</span><span>4 stages</span>
              </div>
              <ol className="mt-4 flex flex-col gap-3.5">
                {STEPS.map((s, i) => (
                  <li key={s.n} className="flex items-center gap-3.5">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${i === 0 ? "bg-accent text-white" : "bg-accent-tint text-accent"}`}><Icon name={s.icon} /></span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold tracking-[0.08em] text-muted">{s.n}/04</span>
                      <span className="block text-[15px] font-bold leading-tight text-ink">{s.title}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-panel" role="presentation"><div className="grad-bar h-full w-1/4 rounded-full" /></div>
              <p className="mt-2 text-[12px] text-muted">Start at 01 and unlock each stage as you go.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5" aria-label="Programme figures">
          <dl className="grid divide-y divide-line rounded-2xl border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {stats.map((s) => (
              <div key={s.label} className="px-7 py-6">
                <dd className="text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink">{s.value}</dd>
                <dt className="mt-2 text-[14px] text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section id="how-it-works" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pt-24">
          <h2 className="text-[34px] font-extrabold tracking-[-0.035em] text-ink">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-line bg-surface p-6">
                <span className="text-[13px] font-bold tracking-[0.08em] text-accent">{s.n}</span>
                <h3 className="mt-3 text-[19px] font-bold tracking-tight text-ink">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="curriculum" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pt-24">
          <h2 className="text-[34px] font-extrabold tracking-[-0.035em] text-ink">Curriculum</h2>
          <p className="mt-2 max-w-xl text-muted">The core modules of the default training programme, in order. Optional specialist tracks are unlocked later.</p>
          {modules.length === 0 ? (
            <p className="mt-6 text-muted">No modules are published yet.</p>
          ) : (
            <ol className="mt-8 grid gap-3 sm:grid-cols-2">
              {modules.map((m, i) => (
                <li key={m.id} className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[13px] font-bold text-accent">{i + 1}</span>
                  <span className="font-semibold text-ink">{m.title}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section id="reviewers" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 py-24">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-line bg-surface p-8 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h2 className="text-[34px] font-extrabold tracking-[-0.035em] text-ink">For reviewers</h2>
              <p className="mt-3 text-[16px] leading-relaxed">
                Reviewers see every trainee submission in a 3D viewer with the ground-truth overlay, and decide to approve it or request a revision with notes.
                Your queue, decisions and feedback history are tracked in one place.
              </p>
            </div>
            <Link href="/login" className={`${primary} h-12 shrink-0 px-7 text-[16px]`}>Sign in</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/80 py-6 text-center text-[13px] text-muted">LiDAR Academy · internal training portal</footer>
    </div>
  );
}
