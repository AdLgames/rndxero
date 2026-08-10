import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Small hand-rolled signed token (HMAC-SHA256 over a base64url JSON
 * payload) — used for magic-link sign-in and session cookies. No JWT
 * library dependency: the format here is simpler than the JWT spec
 * (fixed algorithm, no header) and reviewing ~30 lines of HMAC signing is
 * easier than trusting a general-purpose JWT parser's edge cases.
 */

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export function signToken(payload: Record<string, unknown>, secret: string): string {
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = createHmac("sha256", secret).update(payloadB64).digest();
  return `${payloadB64}.${base64url(signature)}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string, secret: string): T | null {
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return null;

  const expectedSignature = createHmac("sha256", secret).update(payloadB64).digest();
  const actualSignature = Buffer.from(signatureB64, "base64url");

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as T & {
      expiresAt?: number;
    };
    if (typeof payload.expiresAt === "number" && payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
