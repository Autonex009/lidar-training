/** Locale date/time that may differ between server and browser; hydration mismatch is expected and harmless. */
export function LocalTime({ iso, date = false }: { iso: string; date?: boolean }) {
  const d = new Date(iso);
  return <time dateTime={iso} suppressHydrationWarning>{date ? d.toLocaleDateString() : d.toLocaleString()}</time>;
}
