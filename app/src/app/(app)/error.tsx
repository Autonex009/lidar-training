"use client";

import { ErrorView } from "@/components/ErrorView";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="p-6"><ErrorView {...props} /></div>;
}
