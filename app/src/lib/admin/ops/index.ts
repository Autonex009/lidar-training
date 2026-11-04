import type { Role } from "@prisma/client";
import { userOps } from "./users";
import { programOps } from "./programs";
import { taskOps } from "./tasks";
import { assetOps } from "./assets";
import { fail, type AdminActor, type OpDef, type OpResult } from "../types";

export const ops: Record<string, OpDef> = { ...userOps, ...programOps, ...taskOps, ...assetOps };

/** Single dispatcher used by POST /api/admin/op/[name]: role check -> zod parse -> run. */
export async function runOp(name: string, actor: AdminActor | null, raw: unknown): Promise<OpResult> {
  if (!actor) return fail(401, "Unauthorized");
  const op = Object.hasOwn(ops, name) ? ops[name] : undefined;
  if (!op) return fail(404, `Unknown operation "${name}".`);
  if (!op.roles.includes(actor.role as Role)) return fail(403, "Forbidden");
  const parsed = op.input.safeParse(raw);
  if (!parsed.success) return fail(400, parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`).join("; "));
  try {
    return await op.run(actor, parsed.data);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Operation failed");
  }
}
