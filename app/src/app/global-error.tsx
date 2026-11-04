"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111", padding: 24, fontSize: 13 }}>
        <div role="alert" style={{ maxWidth: 420, margin: "0 auto", border: "1px solid #e5e5e5", padding: 16 }}>
          <h1 style={{ fontSize: 15, margin: "0 0 4px" }}>Something went wrong</h1>
          <p style={{ color: "#6b7280" }}>An unexpected error occurred.</p>
          {error.digest ? <p style={{ color: "#6b7280", fontSize: 12 }}>Error reference: <code>{error.digest}</code></p> : null}
          <button type="button" onClick={reset} style={{ height: 32, padding: "0 12px", background: "#c6f135", border: "1px solid #e5e5e5", borderRadius: 6, fontWeight: 500 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
