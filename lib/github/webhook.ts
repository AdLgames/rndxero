import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** A fresh, unguessable per-repo webhook secret — this is what makes the signature check below meaningful. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Verifies GitHub's `X-Hub-Signature-256` header (`sha256=<hex hmac>`)
 * against the raw request body, using this repo link's own secret.
 * Timing-safe compare, same pattern as lib/auth/tokens.ts's token
 * signing — a `===` string compare here would leak timing information
 * about how many leading bytes matched.
 */
export function verifyGithubSignature(payload: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const provided = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(expected, provided);
}
