import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateWebhookSecret, verifyGithubSignature } from "@/lib/github/webhook";

function sign(payload: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("generateWebhookSecret", () => {
  it("produces a long, distinct secret each time", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});

describe("verifyGithubSignature", () => {
  const secret = "test-secret";
  const payload = '{"repository":{"full_name":"acme/widgets"}}';

  it("accepts a correctly signed payload", () => {
    expect(verifyGithubSignature(payload, sign(payload, secret), secret)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    expect(verifyGithubSignature(payload, sign(payload, "wrong-secret"), secret)).toBe(false);
  });

  it("rejects a tampered payload with a valid-looking signature for the original", () => {
    const validSignature = sign(payload, secret);
    expect(verifyGithubSignature(payload + "tampered", validSignature, secret)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyGithubSignature(payload, null, secret)).toBe(false);
  });

  it("rejects a header without the sha256= prefix", () => {
    expect(verifyGithubSignature(payload, "deadbeef", secret)).toBe(false);
  });

  it("rejects a signature of a different length without throwing", () => {
    expect(verifyGithubSignature(payload, "sha256=ab", secret)).toBe(false);
  });
});
