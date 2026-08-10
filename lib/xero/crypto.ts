import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric encryption for Xero access/refresh tokens at rest
 * (XeroConnection.accessTokenEncrypted / refreshTokenEncrypted). Never log
 * or persist a raw token — this is the only place plaintext tokens should
 * exist outside of the HTTP call to Xero itself.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "claimtrail-xero-token", 32);
}

function requireSecret(): string {
  const secret = process.env.XERO_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("XERO_TOKEN_ENCRYPTION_KEY is not set");
  }
  return secret;
}

/** Returns `iv:authTag:ciphertext`, each hex-encoded. */
export function encryptToken(plaintext: string, secret: string = requireSecret()): string {
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secret);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptToken(payload: string, secret: string = requireSecret()): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted token payload");
  }
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
