import { afterEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: sendMock } };
  }),
}));

describe("sendEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sendMock.mockReset();
    vi.resetModules();
  });

  it("falls back to logging (not sending) when RESEND_API_KEY is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEmail } = await import("@/lib/email/send");

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Sign in",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(result).toEqual({ sent: false });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("calls Resend with the given content when RESEND_API_KEY is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "ClaimTrail <hello@example.com>");
    sendMock.mockResolvedValue({ data: { id: "email_1" }, error: null });
    const { sendEmail } = await import("@/lib/email/send");

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Sign in",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(result).toEqual({ sent: true });
    expect(sendMock).toHaveBeenCalledWith({
      from: "ClaimTrail <hello@example.com>",
      to: "user@example.com",
      subject: "Sign in",
      html: "<p>hi</p>",
      text: "hi",
    });
  });

  it("throws when Resend returns an error", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    sendMock.mockResolvedValue({ data: null, error: { message: "invalid domain" } });
    const { sendEmail } = await import("@/lib/email/send");

    await expect(
      sendEmail({ to: "user@example.com", subject: "Sign in", html: "<p>hi</p>", text: "hi" })
    ).rejects.toThrow(/invalid domain/);
  });
});
