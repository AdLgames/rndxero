import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "@/lib/auth/tokens";

const SECRET = "test-secret";

describe("signToken / verifyToken", () => {
  it("round-trips a payload", () => {
    const token = signToken({ userId: "user-1" }, SECRET);
    expect(verifyToken<{ userId: string }>(token, SECRET)?.userId).toBe("user-1");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signToken({ userId: "user-1" }, SECRET);
    expect(verifyToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signToken({ userId: "user-1" }, SECRET);
    const [, signature] = token.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ userId: "attacker" })).toString("base64url")}.${signature}`;
    expect(verifyToken(tampered, SECRET)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyToken("not-a-token", SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signToken({ userId: "user-1", expiresAt: Date.now() - 1000 }, SECRET);
    expect(verifyToken(token, SECRET)).toBeNull();
  });

  it("accepts a token that has not yet expired", () => {
    const token = signToken({ userId: "user-1", expiresAt: Date.now() + 60_000 }, SECRET);
    expect(verifyToken<{ userId: string }>(token, SECRET)?.userId).toBe("user-1");
  });
});
