import { describe, expect, it } from "vitest";
import { isEmailDomainAllowed, isInviteCodeValid } from "@/lib/registration";

describe("registration", () => {
  it("allows any domain when list empty", () => {
    expect(isEmailDomainAllowed("a@b.com", "")).toBe(true);
    expect(isEmailDomainAllowed("a@b.com", undefined)).toBe(true);
  });

  it("restricts to listed domains, case-insensitively", () => {
    expect(isEmailDomainAllowed("a@Encord.com", "encord.com, example.org")).toBe(true);
    expect(isEmailDomainAllowed("a@example.org", "@encord.com,example.org")).toBe(true);
    expect(isEmailDomainAllowed("a@evil.com", "encord.com")).toBe(false);
    expect(isEmailDomainAllowed("a@sub.encord.com", "encord.com")).toBe(false);
    expect(isEmailDomainAllowed("nonsense", "encord.com")).toBe(false);
  });

  it("validates invite code only when configured", () => {
    expect(isInviteCodeValid("", "")).toBe(true);
    expect(isInviteCodeValid("x", "secret")).toBe(false);
    expect(isInviteCodeValid(" secret ", "secret")).toBe(true);
  });
});
