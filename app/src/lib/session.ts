import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

/**
 * Returns the current user or redirects to /login (or /learn when role is insufficient).
 * A JWT whose user row no longer exists (e.g. database reset) is treated as stale and
 * the browser is sent through /api/auth/stale, which clears the cookie.
 * For route handlers prefer `getSessionUser` and return 401/403 yourself.
 */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await loadUser(session.user.id);
  if (!user) redirect("/api/auth/stale");
  if (roles && !roles.includes(user.role)) redirect("/learn?msg=forbidden");
  return user;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return loadUser(session.user.id);
}

/** Role, name and email always come from the database so admin changes apply immediately. */
async function loadUser(id: string): Promise<SessionUser | null> {
  const row = await db.user.findUnique({ where: { id }, select: { id: true, role: true, name: true, email: true } });
  if (!row) return null;
  return { id: row.id, role: row.role, name: row.name, email: row.email };
}
