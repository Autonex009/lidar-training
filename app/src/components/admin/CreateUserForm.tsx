"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Labeled, Status, useOp } from "./client";
import { inputCls } from "./ui";

export function CreateUserForm() {
  const o = useOp();
  const [f, setF] = useState({ name: "", email: "", role: "TRAINEE", password: "" });
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setCreated(null);
        const r = await o.run<{ email: string; password: string }>("user.create", { ...f, password: f.password || undefined }, { ok: () => "User created." });
        if (r.ok) { setCreated(r.data); setF({ name: "", email: "", role: "TRAINEE", password: "" }); }
      }}
    >
      <div className="grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-4">
        <Labeled label="Name"><input required className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Labeled>
        <Labeled label="Email"><input required type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Labeled>
        <Labeled label="Role">
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{["TRAINEE", "REVIEWER", "ADMIN"].map((r) => <option key={r}>{r}</option>)}</select>
        </Labeled>
        <Labeled label="Temporary password" hint="Blank = generate"><input className={inputCls} value={f.password} minLength={8} onChange={(e) => setF({ ...f, password: e.target.value })} /></Labeled>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={o.pending}>Create user</Button>
        <Status error={o.error} message={o.message} />
      </div>
      {created ? <p className="text-[13px]">Temporary password for {created.email} (shown once): <code className="rounded bg-panel px-1">{created.password}</code></p> : null}
    </form>
  );
}
