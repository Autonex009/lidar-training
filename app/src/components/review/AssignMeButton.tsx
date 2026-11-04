"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function AssignMeButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} className="h-6 px-2 text-[11px]" data-testid="assign-me-row" onClick={async () => {
      setBusy(true);
      await fetch("/api/reviews/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId }) }).catch(() => undefined);
      setBusy(false);
      router.refresh();
    }}>Assign to me</Button>
  );
}
