import { describe, expect, it } from "vitest";
import { buildInvitationEmail, buildMagicLinkEmail, buildWeeklyNudgeEmail } from "@/lib/email/templates";

describe("buildMagicLinkEmail", () => {
  it("includes the link in both html and text for sign-in", () => {
    const content = buildMagicLinkEmail({ link: "https://app.example.com/cb?token=abc", context: "sign-in" });

    expect(content.subject).toBe("Sign in to ClaimTrail");
    expect(content.html).toContain("https://app.example.com/cb?token=abc");
    expect(content.text).toContain("https://app.example.com/cb?token=abc");
    expect(content.text).toContain("15 minutes");
  });

  it("uses signup-specific copy for the signup context", () => {
    const content = buildMagicLinkEmail({ link: "https://app.example.com/cb?token=abc", context: "signup" });

    expect(content.subject).toBe("Confirm your ClaimTrail company");
    expect(content.html).toContain("Confirm and sign in");
  });
});

describe("buildInvitationEmail", () => {
  it("names the inviter and company in the subject and body", () => {
    const content = buildInvitationEmail({
      link: "https://app.example.com/invitations/xyz",
      companyName: "Acme R&D",
      inviterName: "Jamie",
    });

    expect(content.subject).toBe("Jamie invited you to Acme R&D on ClaimTrail");
    expect(content.html).toContain("Acme R&D");
    expect(content.html).toContain("https://app.example.com/invitations/xyz");
    expect(content.text).toContain("7 days");
  });
});

describe("buildWeeklyNudgeEmail", () => {
  it("singular-cases the subject for exactly one missing project", () => {
    const content = buildWeeklyNudgeEmail({
      link: "https://app.example.com/capture?week=2026-W33",
      weekKey: "2026-W33",
      missingProjectNames: ["Widget Engine"],
    });
    expect(content.subject).toBe("Log week 2026-W33 on Widget Engine");
    expect(content.html).toContain("Widget Engine");
    expect(content.text).toContain("https://app.example.com/capture?week=2026-W33");
  });

  it("counts projects in the subject when there is more than one", () => {
    const content = buildWeeklyNudgeEmail({
      link: "https://app.example.com/capture?week=2026-W33",
      weekKey: "2026-W33",
      missingProjectNames: ["Widget Engine", "Payments Sync"],
    });
    expect(content.subject).toBe("Log week 2026-W33 on 2 projects");
    expect(content.html).toContain("Widget Engine, Payments Sync");
  });
});
