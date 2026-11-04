/** Pure helpers for registration gating. */

export function parseAllowedDomains(csv: string | undefined | null): string[] {
  return (csv ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** Empty allow-list means any domain is allowed. */
export function isEmailDomainAllowed(email: string, allowedCsv: string | undefined | null): boolean {
  const allowed = parseAllowedDomains(allowedCsv);
  if (allowed.length === 0) return true;
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return allowed.includes(domain);
}

/** Empty configured code means no invite code is required. */
export function isInviteCodeValid(provided: string | undefined | null, required: string | undefined | null): boolean {
  const req = (required ?? "").trim();
  if (!req) return true;
  return (provided ?? "").trim() === req;
}
