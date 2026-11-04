import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Public: reports whether first-admin setup is still available. */
export async function GET() {
  const admins = await db.user.count({ where: { role: "ADMIN" } });
  return NextResponse.json({ setupAvailable: admins === 0 });
}
