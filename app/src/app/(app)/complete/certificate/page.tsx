import { redirect } from "next/navigation";
import { requireSection } from "@/lib/guard";
import { getCertificate } from "@/lib/review/service";
import { PrintButton } from "@/components/review/PrintButton";

export const dynamic = "force-dynamic";

export default async function CertificatePage() {
  const user = await requireSection("complete");
  const c = await getCertificate(user.id);
  if (!c) redirect("/complete");
  return (
    <div data-testid="certificate">
      <style>{`
        @media print {
          aside, header, nav, .no-print { display: none !important; }
          div.pl-\\[250px\\] { padding-left: 0 !important; }
          main { padding: 0 !important; }
          body { background: #fff !important; }
          .cert { border: 2px solid #111 !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>
      <div className="no-print mb-3 flex items-center gap-3"><PrintButton /></div>
      <article className="cert mx-auto max-w-[760px] border border-line bg-surface p-10 text-center">
        <p className="text-[12px] uppercase tracking-widest text-muted">Certificate of completion</p>
        <h1 className="mt-6 text-2xl font-semibold" data-testid="cert-name">{c.traineeName}</h1>
        <p className="mt-2 text-[13px] text-muted">has successfully completed every required task of</p>
        <h2 className="mt-2 text-lg font-semibold">{c.programName}</h2>
        <p className="mt-2 text-[13px]">Issued {new Date(c.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
        <table className="mx-auto mt-6 w-full max-w-[520px] border border-line text-left text-[13px]">
          <thead className="bg-panel text-[12px] text-muted"><tr><th className="px-2 py-1 font-medium">Task</th><th className="px-2 py-1 font-medium">Title</th><th className="px-2 py-1 text-right font-medium">Score</th></tr></thead>
          <tbody>
            {c.tasks.map((t) => <tr key={t.code}><td className="border-t border-line px-2 py-1 font-medium">{t.code}</td><td className="border-t border-line px-2 py-1">{t.title}</td><td className="border-t border-line px-2 py-1 text-right tabular-nums">{t.score ?? "-"}</td></tr>)}
          </tbody>
          <tfoot><tr><td colSpan={2} className="border-t border-line px-2 py-1 font-medium">Average score</td><td className="border-t border-line px-2 py-1 text-right font-medium tabular-nums" data-testid="cert-average">{c.averageScore ?? "-"}</td></tr></tfoot>
        </table>
        <p className="mt-6 text-[11px] text-muted">Certificate ID {c.certificateId}</p>
      </article>
    </div>
  );
}
