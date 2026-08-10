import type { PrismaClient } from "@/lib/generated/prisma/client";
import { encryptToken } from "@/lib/xero/crypto";
import type { XeroTokenResponse } from "@/lib/xero/oauth";
import type { ParsedSalaryLine } from "@/lib/xero/salary-import";

export async function upsertXeroConnection(
  prisma: PrismaClient,
  companyId: string,
  tenantId: string,
  tokens: XeroTokenResponse
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  return prisma.xeroConnection.upsert({
    where: { companyId },
    update: {
      tenantId,
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted: encryptToken(tokens.refresh_token),
      expiresAt,
      scopes: tokens.scope,
    },
    create: {
      companyId,
      tenantId,
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted: encryptToken(tokens.refresh_token),
      expiresAt,
      scopes: tokens.scope,
    },
  });
}

export async function saveSalaryImport(
  prisma: PrismaClient,
  params: { companyId: string; filename: string; importedById: string; lines: ParsedSalaryLine[] }
) {
  return prisma.manualCostImport.create({
    data: {
      companyId: params.companyId,
      filename: params.filename,
      importedById: params.importedById,
      lines: {
        create: params.lines.map((line) => ({
          personName: line.personName,
          periodStart: line.periodStart,
          periodEnd: line.periodEnd,
          amountMinorUnits: line.amountMinorUnits,
          currency: line.currency,
          description: line.description,
        })),
      },
    },
    include: { lines: true },
  });
}
