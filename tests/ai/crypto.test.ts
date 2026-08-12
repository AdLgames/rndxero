import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/crypto";

const SECRET = "test-secret-do-not-use-in-prod";

describe("encryptApiKey / decryptApiKey", () => {
  it("round-trips an API key", () => {
    const plaintext = "sk-test-abc123";
    const encrypted = encryptApiKey(plaintext, SECRET);
    expect(decryptApiKey(encrypted, SECRET)).toBe(plaintext);
  });

  it("never stores the plaintext key in the encrypted payload", () => {
    const plaintext = "super-secret-api-key-value";
    const encrypted = encryptApiKey(plaintext, SECRET);
    expect(encrypted).not.toContain(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptApiKey("same-key", SECRET);
    const b = encryptApiKey("same-key", SECRET);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong secret", () => {
    const encrypted = encryptApiKey("key", SECRET);
    expect(() => decryptApiKey(encrypted, "wrong-secret")).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decryptApiKey("not-a-valid-payload", SECRET)).toThrow(/Malformed/);
  });
});
