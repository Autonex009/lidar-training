import { AdminTabs } from "@/components/admin/AdminTabs";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN", "REVIEWER"]);
  return (
    <div>
      {user.role === "ADMIN" ? (
        <AdminTabs />
      ) : null}
      {children}
    </div>
  );
}
