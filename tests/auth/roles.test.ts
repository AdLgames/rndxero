import { describe, expect, it } from "vitest";
import {
  canApprove,
  canLogOwnTime,
  canManageCompany,
  isScopedToCompany,
  roleForCompany,
  type MembershipLike,
} from "@/lib/auth/roles";

describe("canManageCompany", () => {
  it("is true only for ADMIN", () => {
    expect(canManageCompany({ role: "ADMIN", companyId: "c1" })).toBe(true);
    expect(canManageCompany({ role: "CONTRIBUTOR", companyId: "c1" })).toBe(false);
    expect(canManageCompany({ role: "FINANCE_APPROVER", companyId: "c1" })).toBe(false);
    expect(canManageCompany({ role: "ADVISER", companyId: "c1" })).toBe(false);
  });
});

describe("canLogOwnTime", () => {
  it("is true for ADMIN and CONTRIBUTOR", () => {
    expect(canLogOwnTime({ role: "ADMIN", companyId: "c1" })).toBe(true);
    expect(canLogOwnTime({ role: "CONTRIBUTOR", companyId: "c1" })).toBe(true);
  });

  it("is false for FINANCE_APPROVER and ADVISER", () => {
    expect(canLogOwnTime({ role: "FINANCE_APPROVER", companyId: "c1" })).toBe(false);
    expect(canLogOwnTime({ role: "ADVISER", companyId: "c1" })).toBe(false);
  });
});

describe("canApprove", () => {
  it("is true for ADMIN and FINANCE_APPROVER only", () => {
    expect(canApprove({ role: "ADMIN", companyId: "c1" })).toBe(true);
    expect(canApprove({ role: "FINANCE_APPROVER", companyId: "c1" })).toBe(true);
    expect(canApprove({ role: "CONTRIBUTOR", companyId: "c1" })).toBe(false);
    expect(canApprove({ role: "ADVISER", companyId: "c1" })).toBe(false);
  });
});

describe("isScopedToCompany / roleForCompany", () => {
  const memberships: MembershipLike[] = [
    { role: "ADVISER", companyId: "client-a" },
    { role: "ADVISER", companyId: "client-b" },
  ];

  it("scopes an adviser to only their assigned clients", () => {
    expect(isScopedToCompany(memberships, "client-a")).toBe(true);
    expect(isScopedToCompany(memberships, "client-c")).toBe(false);
  });

  it("resolves the role held for a specific company", () => {
    expect(roleForCompany(memberships, "client-b")).toBe("ADVISER");
    expect(roleForCompany(memberships, "client-c")).toBeNull();
  });
});
