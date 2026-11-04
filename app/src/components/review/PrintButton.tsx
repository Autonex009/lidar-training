"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return <Button variant="primary" onClick={() => window.print()} data-testid="print-certificate">Print</Button>;
}
