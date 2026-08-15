import { describe, expect, it } from "vitest";
import { can } from "@/lib/authz/permissions";
import type { AuthzSubject } from "@/lib/authz/types";

function subject(overrides: Partial<AuthzSubject> = {}): AuthzSubject {
  return {
    userId: "user-1",
    companyRole: "CONTRIBUTOR",
    companyStatus: "ACTIVE",
    canViewCosts: false,
    projectRole: "CONTRIBUTOR",
    ...overrides,
  };
}

describe("baseline gates", () => {
  it("denies everything for a user with no membership", () => {
    expect(can(subject({ companyRole: null, companyStatus: null, projectRole: null }), "project:read")).toBe(
      false
    );
  });

  it("denies everything for a REMOVED membership regardless of role", () => {
    expect(can(subject({ companyRole: "OWNER", companyStatus: "REMOVED" }), "project:read")).toBe(false);
  });

  it("denies everything for an INVITED (not yet ACTIVE) membership", () => {
    expect(can(subject({ companyRole: "CONTRIBUTOR", companyStatus: "INVITED" }), "project:read")).toBe(
      false
    );
  });
});

describe("Owner", () => {
  it("can do everything, including billing and membership", () => {
    const s = subject({ companyRole: "OWNER", projectRole: null });
    expect(can(s, "billing:manage")).toBe(true);
    expect(can(s, "membership:manage")).toBe(true);
    expect(can(s, "company:update")).toBe(true);
    expect(can(s, "rate:write")).toBe(true);
    expect(can(s, "submission:lock")).toBe(true);
  });

  it("acts company-wide without needing a ProjectMember row", () => {
    expect(can(subject({ companyRole: "OWNER", projectRole: null }), "project:read")).toBe(true);
  });

  it("still cannot directly update another user's submission (hard rule overrides role)", () => {
    const owner = subject({ companyRole: "OWNER", userId: "owner-1" });
    expect(can(owner, "submission:update", { ownerId: "someone-else" })).toBe(false);
  });
});

describe("Finance", () => {
  const finance = () => subject({ companyRole: "FINANCE", projectRole: null });

  it("can manage rates, lock/unlock weeks, see all costs, export", () => {
    const s = finance();
    expect(can(s, "rate:read")).toBe(true);
    expect(can(s, "rate:write")).toBe(true);
    expect(can(s, "submission:lock")).toBe(true);
    expect(can(s, "submission:unlock")).toBe(true);
    expect(can(s, "cost:read")).toBe(true);
    expect(can(s, "cost:write")).toBe(true);
    expect(can(s, "export:read")).toBe(true);
  });

  it("cannot directly edit submissions", () => {
    expect(can(finance(), "submission:update", { ownerId: "finance-user" })).toBe(false);
  });

  it("can still correct via amendment", () => {
    expect(can(finance(), "submission:amend")).toBe(true);
  });

  it("cannot create projects or manage billing/membership/company details", () => {
    const s = finance();
    expect(can(s, "project:create")).toBe(false);
    expect(can(s, "billing:manage")).toBe(false);
    expect(can(s, "membership:manage")).toBe(false);
    expect(can(s, "company:update")).toBe(false);
  });

  it("acts company-wide for cost/rate/lock actions without a ProjectMember row", () => {
    expect(can(finance(), "submission:lock")).toBe(true);
  });

  it("cannot remap a note (board curation isn't a Finance action)", () => {
    expect(can(finance(), "note:remap")).toBe(false);
  });
});

describe("Lead", () => {
  it("can create uncertainties and own the plan on a project they lead", () => {
    const s = subject({ companyRole: "LEAD", projectRole: "LEAD" });
    expect(can(s, "uncertainty:create")).toBe(true);
    expect(can(s, "plan:write")).toBe(true);
    expect(can(s, "projectMember:invite")).toBe(true);
  });

  it("has no standing on a project they are not a member of", () => {
    const s = subject({ companyRole: "LEAD", projectRole: null });
    expect(can(s, "uncertainty:create")).toBe(false);
    expect(can(s, "project:read")).toBe(false);
  });

  it("sees hours but not rates or costs by default", () => {
    const s = subject({ companyRole: "LEAD", projectRole: "LEAD", canViewCosts: false });
    expect(can(s, "submission:read")).toBe(true);
    expect(can(s, "rate:read")).toBe(false);
    expect(can(s, "cost:read")).toBe(false);
  });

  it("sees costs when canViewCosts is granted", () => {
    const s = subject({ companyRole: "LEAD", projectRole: "LEAD", canViewCosts: true });
    expect(can(s, "cost:read")).toBe(true);
  });

  it("still cannot write rates even with canViewCosts", () => {
    const s = subject({ companyRole: "LEAD", projectRole: "LEAD", canViewCosts: true });
    expect(can(s, "rate:write")).toBe(false);
  });

  it("cannot lock or unlock weeks", () => {
    const s = subject({ companyRole: "LEAD", projectRole: "LEAD" });
    expect(can(s, "submission:lock")).toBe(false);
    expect(can(s, "submission:unlock")).toBe(false);
  });

  it("can remap a note on their project, not just their own (board drag-to-remap is not ownership-restricted)", () => {
    const s = subject({ companyRole: "LEAD", projectRole: "LEAD", userId: "lead-1" });
    expect(can(s, "note:remap", { ownerId: "someone-else" })).toBe(true);
  });

  it("cannot remap on a project they have no standing on", () => {
    const s = subject({ companyRole: "LEAD", projectRole: null });
    expect(can(s, "note:remap")).toBe(false);
  });
});

describe("Contributor", () => {
  it("can submit own capture and read the board for their projects", () => {
    const s = subject({ companyRole: "CONTRIBUTOR", projectRole: "CONTRIBUTOR" });
    expect(can(s, "submission:create")).toBe(true);
    expect(can(s, "note:create")).toBe(true);
    expect(can(s, "project:read")).toBe(true);
  });

  it("has no standing on a project they are not on", () => {
    const s = subject({ companyRole: "CONTRIBUTOR", projectRole: null });
    expect(can(s, "project:read")).toBe(false);
    expect(can(s, "submission:read")).toBe(false);
  });

  it("cannot read rates or costs even with canViewCosts unset", () => {
    const s = subject({ companyRole: "CONTRIBUTOR", projectRole: "CONTRIBUTOR", canViewCosts: false });
    expect(can(s, "rate:read")).toBe(false);
    expect(can(s, "cost:read")).toBe(false);
  });

  it("cannot see costs even when explicitly granted canViewCosts (not in the Contributor matrix at all)", () => {
    const s = subject({ companyRole: "CONTRIBUTOR", projectRole: "CONTRIBUTOR", canViewCosts: true });
    expect(can(s, "cost:read")).toBe(false);
  });

  it("cannot write a plan or invite anyone", () => {
    const s = subject({ companyRole: "CONTRIBUTOR", projectRole: "CONTRIBUTOR" });
    expect(can(s, "plan:write")).toBe(false);
    expect(can(s, "projectMember:invite")).toBe(false);
  });

  it("cannot remap a note (board curation is Lead-and-above)", () => {
    const s = subject({ companyRole: "CONTRIBUTOR", projectRole: "CONTRIBUTOR" });
    expect(can(s, "note:remap")).toBe(false);
  });
});

describe("Adviser", () => {
  it("is read-only on shared projects, plus export", () => {
    const s = subject({ companyRole: "ADVISER", projectRole: "ADVISER" });
    expect(can(s, "project:read")).toBe(true);
    expect(can(s, "submission:read")).toBe(true);
    expect(can(s, "export:read")).toBe(true);
  });

  it("submits nothing and edits nothing", () => {
    const s = subject({ companyRole: "ADVISER", projectRole: "ADVISER" });
    expect(can(s, "submission:create")).toBe(false);
    expect(can(s, "note:create")).toBe(false);
    expect(can(s, "submission:amend")).toBe(false);
    expect(can(s, "note:amend")).toBe(false);
  });

  it("has no standing on a project they are not shared into", () => {
    expect(can(subject({ companyRole: "ADVISER", projectRole: null }), "project:read")).toBe(false);
  });

  it("cannot remap a note", () => {
    expect(can(subject({ companyRole: "ADVISER", projectRole: "ADVISER" }), "note:remap")).toBe(false);
  });
});

describe("the hard rule (ownership), independent of role", () => {
  it.each(["OWNER", "FINANCE", "LEAD", "CONTRIBUTOR"] as const)(
    "%s cannot directly update someone else's submission",
    (role) => {
      const s = subject({ companyRole: role, userId: "me", projectRole: role === "OWNER" || role === "FINANCE" ? null : role });
      expect(can(s, "submission:update", { ownerId: "someone-else" })).toBe(false);
    }
  );

  it.each(["OWNER", "FINANCE", "LEAD", "CONTRIBUTOR"] as const)("%s cannot directly update someone else's note", (role) => {
    const s = subject({ companyRole: role, userId: "me", projectRole: role === "OWNER" || role === "FINANCE" ? null : role });
    expect(can(s, "note:update", { ownerId: "someone-else" })).toBe(false);
  });

  it("a Contributor can update their own submission while it's still theirs to touch", () => {
    const s = subject({ companyRole: "CONTRIBUTOR", userId: "me", projectRole: "CONTRIBUTOR" });
    expect(can(s, "submission:update", { ownerId: "me" })).toBe(true);
  });

  it("is not bypassed by amend actions being separately permitted", () => {
    // Amend is a genuinely different, always-attributed action — this just
    // confirms update and amend are independently gated, not that one implies the other.
    const finance = subject({ companyRole: "FINANCE", projectRole: null });
    expect(can(finance, "submission:update", { ownerId: "someone-else" })).toBe(false);
    expect(can(finance, "submission:amend", { ownerId: "someone-else" })).toBe(true);
  });
});

describe("AI (ai:configure / ai:query)", () => {
  it("only Owner can configure the AI provider — Finance, same footing as billing:manage, cannot", () => {
    expect(can(subject({ companyRole: "OWNER", projectRole: null }), "ai:configure")).toBe(true);
    expect(can(subject({ companyRole: "FINANCE", projectRole: null }), "ai:configure")).toBe(false);
    expect(can(subject({ companyRole: "LEAD" }), "ai:configure")).toBe(false);
    expect(can(subject({ companyRole: "CONTRIBUTOR" }), "ai:configure")).toBe(false);
    expect(can(subject({ companyRole: "ADVISER" }), "ai:configure")).toBe(false);
  });

  it("every active role can query the AI (HMRC guidance Q&A is informational, not sensitive)", () => {
    expect(can(subject({ companyRole: "OWNER", projectRole: null }), "ai:query")).toBe(true);
    expect(can(subject({ companyRole: "FINANCE", projectRole: null }), "ai:query")).toBe(true);
    expect(can(subject({ companyRole: "LEAD" }), "ai:query")).toBe(true);
    expect(can(subject({ companyRole: "CONTRIBUTOR" }), "ai:query")).toBe(true);
    expect(can(subject({ companyRole: "ADVISER" }), "ai:query")).toBe(true);
  });

  it("ai:query is not project-scoped — no ProjectMember row needed", () => {
    expect(can(subject({ companyRole: "CONTRIBUTOR", projectRole: null }), "ai:query")).toBe(true);
  });
});

describe("comment:create / comment:read (submission comment threads)", () => {
  it("Owner, Finance, Lead, and Contributor can all post a comment", () => {
    expect(can(subject({ companyRole: "OWNER", projectRole: null }), "comment:create")).toBe(true);
    expect(can(subject({ companyRole: "FINANCE", projectRole: null }), "comment:create")).toBe(true);
    expect(can(subject({ companyRole: "LEAD" }), "comment:create")).toBe(true);
    expect(can(subject({ companyRole: "CONTRIBUTOR" }), "comment:create")).toBe(true);
  });

  it("Adviser can read but not post — read-only across the board", () => {
    const adviser = subject({ companyRole: "ADVISER", projectRole: "ADVISER" });
    expect(can(adviser, "comment:read")).toBe(true);
    expect(can(adviser, "comment:create")).toBe(false);
  });

  it("is project-scoped — Owner/Finance act company-wide, everyone else needs standing on the project", () => {
    expect(can(subject({ companyRole: "OWNER", projectRole: null }), "comment:read")).toBe(true);
    expect(can(subject({ companyRole: "LEAD", projectRole: null }), "comment:read")).toBe(false);
  });
});

describe("BOARD-PLAN.md Phase 2 'done when' scenarios", () => {
  it("a contributor's session provably cannot read a rate", () => {
    const contributor = subject({ companyRole: "CONTRIBUTOR", projectRole: "CONTRIBUTOR", canViewCosts: false });
    expect(can(contributor, "rate:read")).toBe(false);
  });

  it("a contributor's session provably cannot read another project's board", () => {
    // No projectRole because they are not a ProjectMember of that project.
    const contributor = subject({ companyRole: "CONTRIBUTOR", projectRole: null });
    expect(can(contributor, "project:read")).toBe(false);
    expect(can(contributor, "uncertainty:read")).toBe(false);
    expect(can(contributor, "submission:read")).toBe(false);
  });
});
