"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Status, useOp } from "./client";
import { inputCls } from "./ui";

export interface ProgramOption { id: string; name: string }

/** Role change, enroll/unenroll and password reset for one user. */
export function UserControls({ userId, role, programs, enrolledIds }: { userId: string; role: string; programs: ProgramOption[]; enrolledIds: string[] }) {
  const o = useOp();
  const [newRole, setNewRole] = useState(role);
  const [programId, setProgramId] = useState(programs.find((p) => !enrolledIds.includes(p.id))?.id ?? programs[0]?.id ?? "");
  const [shown, setShown] = useState<string | null>(null);
  const enrolled = enrolledIds.includes(programId);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select aria-label="Role" className={inputCls} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
          {["TRAINEE", "REVIEWER", "ADMIN"].map((r) => <option key={r}>{r}</option>)}
        </select>
        <Button disabled={o.pending || newRole === role} onClick={() => o.run("user.setRole", { userId, role: newRole }, { ok: (d) => String((d as { note?: string }).note ?? "Saved.") })}>Set role</Button>
        <span className="mx-1 text-line">|</span>
        <select aria-label="Program" className={inputCls} value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{enrolledIds.includes(p.id) ? " (enrolled)" : ""}</option>)}
        </select>
        {enrolled
          ? <Button disabled={o.pending} onClick={() => { if (window.confirm("Unenroll? Progress and assignments are kept.")) void o.run("user.unenroll", { userId, programId }); }}>Unenroll</Button>
          : <Button disabled={o.pending || !programId} onClick={() => o.run("user.enroll", { userId, programId }, { ok: (d) => `Enrolled (${(d as { assignmentsCreated?: number }).assignmentsCreated ?? 0} assignments created).` })}>Enroll</Button>}
        <span className="mx-1 text-line">|</span>
        <Button disabled={o.pending} onClick={async () => {
          const pw = window.prompt("New password (min 8 chars). Leave blank to generate one.") ;
          if (pw === null) return;
          const r = await o.run<{ password: string }>("user.resetPassword", pw ? { userId, password: pw } : { userId }, { ok: () => "Password reset." });
          if (r.ok) setShown(r.data.password);
        }}>Reset password</Button>
      </div>
      {shown ? <p className="text-[13px]">New password (shown once): <code className="rounded bg-panel px-1">{shown}</code></p> : null}
      <Status error={o.error} message={o.message} />
    </div>
  );
}
