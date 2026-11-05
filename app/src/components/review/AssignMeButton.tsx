"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function AssignMeButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} className="h-8 rounded-full px-3 text-[13px]" data-testid="assign-me-row" onClick={async () => {
      setBusy(true);
      await fetch("/api/reviews/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId }) }).catch(() => undefined);
      setBusy(false);
      router.refresh();
    }}>Assign to me</Button>
  );
}
