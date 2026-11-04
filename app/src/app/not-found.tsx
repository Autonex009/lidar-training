import Link from "next/link";

export default function NotFound() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-md border border-line bg-surface p-4 text-[13px]">
        <h1 className="mb-1 text-[15px] font-semibold">Page not found</h1>
        <p className="mb-2 text-muted">It may not exist, or you may not have access to it.</p>
        <Link href="/learn" className="underline">Back to Learn</Link>
      </div>
    </div>
  );
}
