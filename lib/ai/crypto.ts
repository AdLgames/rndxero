import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric encryption for AiProviderConfig.apiKeyEncrypted — a company's
 * own AI provider credential (OpenAI, Azure OpenAI, or a self-hosted
 * endpoint's key). Mirrors lib/xero/crypto.ts's approach but with its own
 * env var and salt, so this key is independent of the Xero token key.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "claimtrail-ai-provider-key", 32);
}

function requireSecret(): string {
  const secret = process.env.AI_PROVIDER_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("AI_PROVIDER_ENCRYPTION_KEY is not set");
  }
  return secret;
}

/** Returns `iv:authTag:ciphertext`, each hex-encoded. */
export function encryptApiKey(plaintext: string, secret: string = requireSecret()): string {
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secret);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptApiKey(payload: string, secret: string = requireSecret()): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted API key payload");
  }
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}
