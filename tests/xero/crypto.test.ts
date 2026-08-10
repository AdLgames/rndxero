import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/xero/crypto";

const SECRET = "test-secret-do-not-use-in-prod";

describe("encryptToken / decryptToken", () => {
  it("round-trips a token", () => {
    const plaintext = "xero-access-token-abc123";
    const encrypted = encryptToken(plaintext, SECRET);
    expect(decryptToken(encrypted, SECRET)).toBe(plaintext);
  });

  it("never stores the plaintext token in the encrypted payload", () => {
    const plaintext = "super-secret-token-value";
    const encrypted = encryptToken(plaintext, SECRET);
    expect(encrypted).not.toContain(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptToken("same-token", SECRET);
    const b = encryptToken("same-token", SECRET);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong secret", () => {
    const encrypted = encryptToken("token", SECRET);
    expect(() => decryptToken(encrypted, "wrong-secret")).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decryptToken("not-a-valid-payload", SECRET)).toThrow(/Malformed/);
  });
});
