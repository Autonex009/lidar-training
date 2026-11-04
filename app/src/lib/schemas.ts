import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Valid email required"),
  password: z.string().min(8, "At least 8 characters").max(200),
  inviteCode: z.string().trim().max(200).optional(),
});

export const setupSchema = registerSchema.extend({
  setupToken: z.string().min(1, "Setup token required").max(500),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
