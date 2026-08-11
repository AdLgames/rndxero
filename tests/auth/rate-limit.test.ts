import { describe, expect, it } from "vitest";
import { canSendMagicLink } from "@/lib/auth/rate-limit";

describe("canSendMagicLink", () => {
  it("allows sending when nothing has been sent yet", () => {
    expect(canSendMagicLink(null)).toBe(true);
  });

  it("blocks a resend within the cooldown window", () => {
    const now = new Date("2026-01-01T00:01:00.000Z");
    const lastSentAt = new Date("2026-01-01T00:00:30.000Z"); // 30s ago
    expect(canSendMagicLink(lastSentAt, now, 60_000)).toBe(false);
  });

  it("allows a resend once the cooldown has elapsed", () => {
    const now = new Date("2026-01-01T00:01:01.000Z");
    const lastSentAt = new Date("2026-01-01T00:00:00.000Z"); // 61s ago
    expect(canSendMagicLink(lastSentAt, now, 60_000)).toBe(true);
  });

  it("treats the exact cooldown boundary as allowed", () => {
    const now = new Date("2026-01-01T00:01:00.000Z");
    const lastSentAt = new Date("2026-01-01T00:00:00.000Z"); // exactly 60s ago
    expect(canSendMagicLink(lastSentAt, now, 60_000)).toBe(true);
  });
});
