import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminPage() {
  await requireUser(["ADMIN"]);
  return (
    <>
      <PageHeader title="Admin" />
      <EmptyState title="Nothing here yet" description="Dashboard and program configuration arrive in a later stage." />
    </>
  );
}
