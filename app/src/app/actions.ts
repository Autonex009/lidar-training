"use server";

import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrollInActiveProgram } from "@/lib/enroll";
import { isEmailDomainAllowed, isInviteCodeValid } from "@/lib/registration";
import { clientIp, isRateLimited, loginLimitPerMinute } from "@/lib/rate-limit";
import { loginSchema, registerSchema, setupSchema } from "@/lib/schemas";

export interface FormState {
  error?: string;
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function signInAndGo(email: string, password: string): Promise<void> {
  // signIn throws a redirect on success; let it propagate.
  await signIn("credentials", { email, password, redirectTo: "/learn" });
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: str(fd, "email"), password: str(fd, "password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  try {
    await signInAndGo(parsed.data.email, parsed.data.password);
  } catch (e) {
    if (e instanceof AuthError) {
      if (isRateLimited(`login:${clientIp(await headers())}`, loginLimitPerMinute())) return { error: "Too many sign-in attempts. Try again in a minute." };
      return { error: "Invalid email or password." };
    }
    throw e;
  }
  return {};
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: str(fd, "name"),
    email: str(fd, "email"),
    password: str(fd, "password"),
    inviteCode: str(fd, "inviteCode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, email, password, inviteCode } = parsed.data;

  if (!isEmailDomainAllowed(email, process.env.ALLOWED_EMAIL_DOMAINS)) {
    return { error: "Registration is restricted to approved email domains." };
  }
  if (!isInviteCodeValid(inviteCode, process.env.REGISTRATION_INVITE_CODE)) {
    return { error: "Invalid invite code." };
  }
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with this email already exists." };
  }

  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "TRAINEE" },
  });
  await enrollInActiveProgram(user.id);
  try {
    await signInAndGo(email, password);
  } catch (e) {
    if (e instanceof AuthError) return { error: "Account created. Please sign in." };
    throw e;
  }
  return {};
}

export async function setupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return { error: "SETUP_TOKEN is not configured on the server." };
  if ((await db.user.count({ where: { role: "ADMIN" } })) > 0) {
    return { error: "Setup already completed." };
  }
  const parsed = setupSchema.safeParse({
    name: str(fd, "name"),
    email: str(fd, "email"),
    password: str(fd, "password"),
    setupToken: str(fd, "setupToken"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, email, password, setupToken } = parsed.data;
  if (!safeEqual(setupToken, expected)) return { error: "Invalid setup token." };
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with this email already exists." };
  }

  const admin = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
  });
  await enrollInActiveProgram(admin.id);
  try {
    await signInAndGo(email, password);
  } catch (e) {
    if (e instanceof AuthError) return { error: "Admin created. Please sign in." };
    throw e;
  }
  return {};
}
