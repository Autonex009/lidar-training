import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const MESSAGES: Record<string, string> = {
  locked: "That section is locked. Complete all mandatory modules and pass the final assessment first.",
  forbidden: "You do not have access to that page.",
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireUser();
  const { msg } = await searchParams;
  const notice = msg ? MESSAGES[msg] : undefined;
  return (
    <>
      <PageHeader title="Learn" subtitle="Modules, lessons and knowledge checks." />
      {notice ? (
        <p role="status" className="mb-4 rounded-md border border-line bg-accent-tint px-3 py-2 text-[13px]">{notice}</p>
      ) : null}
      <EmptyState title="No learning content yet" description="Modules will appear here once the program content is seeded." />
    </>
  );
}
