import { requireSection } from "@/lib/guard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ReviewPage() {
  await requireSection("review");
  return (
    <>
      <PageHeader title="Review" />
      <EmptyState title="Nothing here yet" description="This section is built in a later stage." />
    </>
  );
}
