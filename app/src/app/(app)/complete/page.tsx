import { requireSection } from "@/lib/guard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function CompletePage() {
  await requireSection("complete");
  return (
    <>
      <PageHeader title="Complete" />
      <EmptyState title="Nothing here yet" description="This section is built in a later stage." />
    </>
  );
}
