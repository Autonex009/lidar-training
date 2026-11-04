import { signOut } from "@/lib/auth";

/** Clears a session whose user row no longer exists (e.g. after a database reset). */
export async function GET() {
  await signOut({ redirectTo: "/login?msg=session-expired" });
}
