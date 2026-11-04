import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { clientIp, hitRateLimit, loginLimitPerMinute } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        // Per-process, per-IP limit on login attempts (default 10/min; see src/lib/rate-limit.ts).
        if (hitRateLimit(`login:${clientIp(request.headers)}`, loginLimitPerMinute())) return null;
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (user.id) await logActivity(user.id, "LOGIN");
    },
  },
});
