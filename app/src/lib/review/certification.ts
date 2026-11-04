export interface CertTask { code: string; isRequiredForCertification: boolean; isPublished: boolean }

/**
 * Required task codes for a program: `certificationRequirements.requiredTaskCodes` when non-empty,
 * otherwise published tasks flagged `isRequiredForCertification`.
 */
export function requiredCodes(requirements: unknown, tasks: CertTask[]): string[] {
  const configured = (requirements as { requiredTaskCodes?: unknown } | null)?.requiredTaskCodes;
  if (Array.isArray(configured) && configured.length) return configured.filter((c): c is string => typeof c === "string");
  return tasks.filter((t) => t.isPublished && t.isRequiredForCertification).map((t) => t.code);
}

export interface CertEvaluation { required: number; approved: number; remaining: string[]; complete: boolean }

/** Pure certification check. A program with no required tasks never certifies. */
export function evaluateCertification(required: string[], statusByCode: Record<string, string | undefined>): CertEvaluation {
  const remaining = required.filter((c) => statusByCode[c] !== "APPROVED");
  return { required: required.length, approved: required.length - remaining.length, remaining, complete: required.length > 0 && remaining.length === 0 };
}
