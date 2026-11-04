import { redirect } from "next/navigation";
import { requireUser, type SessionUser } from "@/lib/session";
import { getGateStateForUser, type GatedSection } from "@/lib/gate";

/** Server-side guard for gated sections: redirects locked trainees to /learn. */
export async function requireSection(section: GatedSection): Promise<SessionUser> {
  const user = await requireUser();
  const gate = await getGateStateForUser(user.id, user.role);
  if (!gate.unlocked[section]) redirect("/learn?msg=locked");
  return user;
}
