export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
    </header>
  );
}
