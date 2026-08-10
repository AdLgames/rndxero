import type { PrismaClient } from "@/lib/generated/prisma/client";
import { isTokenExpiringSoon } from "@/lib/xero/oauth";

export interface SyncHealth {
  companyId: string;
  companyName: string;
  connected: boolean;
  tenantId: string | null;
  tokenExpiresAt: Date | null;
  tokenExpiringSoon: boolean;
  lastJournalNumber: number | null;
  lastSyncedAt: Date | null;
}

/** Per-tenant Xero connection + GL mirror sync status, for the admin health page (PLAN.md Phase 6). */
export async function getSyncHealthForCompanies(
  prisma: PrismaClient,
  companyIds: string[]
): Promise<SyncHealth[]> {
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    include: { xeroConnection: true },
  });

  return Promise.all(
    companies.map(async (company) => {
      const cursor = company.xeroConnection
        ? await prisma.xeroSyncCursor.findUnique({ where: { companyId: company.id } })
        : null;

      return {
        companyId: company.id,
        companyName: company.name,
        connected: Boolean(company.xeroConnection),
        tenantId: company.xeroConnection?.tenantId ?? null,
        tokenExpiresAt: company.xeroConnection?.expiresAt ?? null,
        tokenExpiringSoon: company.xeroConnection
          ? isTokenExpiringSoon(company.xeroConnection.expiresAt)
          : false,
        lastJournalNumber: cursor?.lastJournalNumber ?? null,
        lastSyncedAt: cursor?.updatedAt ?? null,
      };
    })
  );
}
