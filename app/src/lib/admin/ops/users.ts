import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureAssignments } from "@/lib/tasks/assignments";
import { enrollInActiveProgram } from "@/lib/enroll";
import { ADMIN_ONLY, defineOp, fail, okr } from "../types";

const role = z.enum(["TRAINEE", "REVIEWER", "ADMIN"]);
const password = z.string().min(8).max(200);

export function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

async function lastAdminGuard(userId: string, newRole: string) {
  if (newRole === "ADMIN") return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (u?.role !== "ADMIN") return null;
  const admins = await db.user.count({ where: { role: "ADMIN" } });
  return admins <= 1 ? fail(409, "Cannot demote the last administrator.") : null;
}

export const userOps = {
  "user.create": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().toLowerCase().email(), role, password: password.optional() }),
    async run(_a, i) {
      if (await db.user.findUnique({ where: { email: i.email } })) return fail(409, "A user with that email already exists.");
      const temp = i.password ?? generatePassword();
      const u = await db.user.create({ data: { name: i.name, email: i.email, role: i.role, passwordHash: await bcrypt.hash(temp, 12) } });
      if (i.role === "TRAINEE") await enrollInActiveProgram(u.id);
      return okr({ id: u.id, email: u.email, password: temp });
    },
  }),
  "user.setRole": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ userId: z.string().min(1), role }),
    async run(_a, i) {
      const g = await lastAdminGuard(i.userId, i.role);
      if (g) return g;
      const r = await db.user.updateMany({ where: { id: i.userId }, data: { role: i.role } });
      return r.count ? okr({ note: "Role saved. It applies to the user's session after their next sign-in." }) : fail(404, "User not found.");
    },
  }),
  "user.resetPassword": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ userId: z.string().min(1), password: password.optional() }),
    async run(_a, i) {
      const temp = i.password ?? generatePassword();
      const r = await db.user.updateMany({ where: { id: i.userId }, data: { passwordHash: await bcrypt.hash(temp, 12) } });
      return r.count ? okr({ password: temp }) : fail(404, "User not found.");
    },
  }),
  "user.enroll": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ userId: z.string().min(1), programId: z.string().min(1) }),
    async run(_a, i) {
      const [u, p] = await Promise.all([db.user.findUnique({ where: { id: i.userId } }), db.trainingProgram.findUnique({ where: { id: i.programId } })]);
      if (!u || !p) return fail(404, "User or program not found.");
      await db.enrollment.upsert({ where: { userId_programId: { userId: i.userId, programId: i.programId } }, create: { userId: i.userId, programId: i.programId }, update: {} });
      const created = await ensureAssignments(i.userId, i.programId);
      return okr({ assignmentsCreated: created });
    },
  }),
  "user.unenroll": defineOp({
    roles: ADMIN_ONLY,
    input: z.object({ userId: z.string().min(1), programId: z.string().min(1) }),
    async run(_a, i) {
      const r = await db.enrollment.deleteMany({ where: { userId: i.userId, programId: i.programId } });
      return r.count ? okr({}) : fail(404, "Not enrolled.");
    },
  }),
};
