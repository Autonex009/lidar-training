import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

/**
 * Returns the current user or redirects to /login (or /learn when role is insufficient).
 * For route handlers prefer `getSessionUser` and return 401/403 yourself.
 */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/learn?msg=forbidden");
  return user;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name ?? session.user.email ?? "User",
    email: session.user.email ?? "",
  };
}
