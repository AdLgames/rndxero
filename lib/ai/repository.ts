import type { PrismaClient } from "@/lib/generated/prisma/client";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/crypto";
import type { AiProviderSettings } from "@/lib/ai/provider";

/** The safe, client-facing view of a company's AI config — never the decrypted key, only whether one is set. */
export interface AiProviderConfigSummary {
  label: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  enabled: boolean;
  updatedAt: Date;
}

export async function getAiProviderConfigSummary(prisma: PrismaClient, companyId: string): Promise<AiProviderConfigSummary | null> {
  const config = await prisma.aiProviderConfig.findUnique({ where: { companyId } });
  if (!config) return null;
  return {
    label: config.label,
    baseUrl: config.baseUrl,
    model: config.model,
    hasApiKey: config.apiKeyEncrypted !== null,
    enabled: config.enabled,
    updatedAt: config.updatedAt,
  };
}

/** Resolves the live, decrypted settings a chat call actually needs. Never expose this return value to a client — it carries the plaintext key. */
export async function getAiProviderSettings(prisma: PrismaClient, companyId: string): Promise<AiProviderSettings | null> {
  const config = await prisma.aiProviderConfig.findUnique({ where: { companyId } });
  if (!config || !config.enabled) return null;
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKeyEncrypted ? decryptApiKey(config.apiKeyEncrypted) : null,
  };
}

export interface UpsertAiProviderConfigInput {
  companyId: string;
  createdById: string;
  label: string;
  baseUrl: string;
  model: string;
  /** undefined = leave the existing key untouched; null = clear it; a string = replace it. */
  apiKey?: string | null;
}

export async function upsertAiProviderConfig(prisma: PrismaClient, input: UpsertAiProviderConfigInput): Promise<AiProviderConfigSummary> {
  const apiKeyEncrypted = input.apiKey === undefined ? undefined : input.apiKey === null ? null : encryptApiKey(input.apiKey);

  const config = await prisma.aiProviderConfig.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      createdById: input.createdById,
      label: input.label,
      baseUrl: input.baseUrl,
      model: input.model,
      apiKeyEncrypted: apiKeyEncrypted ?? null,
    },
    update: {
      label: input.label,
      baseUrl: input.baseUrl,
      model: input.model,
      ...(apiKeyEncrypted !== undefined ? { apiKeyEncrypted } : {}),
    },
  });

  return {
    label: config.label,
    baseUrl: config.baseUrl,
    model: config.model,
    hasApiKey: config.apiKeyEncrypted !== null,
    enabled: config.enabled,
    updatedAt: config.updatedAt,
  };
}
