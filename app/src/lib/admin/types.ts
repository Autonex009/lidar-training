import type { Role } from "@prisma/client";
import type { z } from "zod";

export interface AdminActor { id: string; role: Role }

export type OpResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

export const okr = <T,>(data: T): OpResult<T> => ({ ok: true, data });
export const fail = (status: number, error: string): OpResult<never> => ({ ok: false, status, error });

export interface OpDef<S extends z.ZodType = z.ZodType> {
  roles: Role[];
  input: S;
  run: (actor: AdminActor, input: z.infer<S>) => Promise<OpResult>;
}

export function defineOp<S extends z.ZodType>(def: OpDef<S>): OpDef {
  return def as unknown as OpDef;
}

export const ADMIN_ONLY: Role[] = ["ADMIN"];
