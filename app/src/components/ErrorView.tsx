"use client";

export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md border border-line bg-surface p-4 text-[13px]">
      <h1 className="mb-1 text-[15px] font-semibold">Something went wrong</h1>
      <p className="mb-2 text-muted">An unexpected error occurred. You can try again; if it keeps happening, tell your administrator.</p>
      {error.digest ? <p className="mb-2 text-[12px] text-muted">Error reference: <code>{error.digest}</code></p> : null}
      <button type="button" onClick={reset} className="inline-flex h-8 items-center rounded-full border border-accent bg-accent px-3 text-white font-medium">Try again</button>
    </div>
  );
}
