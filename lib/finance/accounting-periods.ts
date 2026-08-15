import type { AccountingPeriod, PrismaClient } from "@/lib/generated/prisma/client";

export class AccountingPeriodError extends Error {}

export interface CreateAccountingPeriodInput {
  companyId: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

export async function createAccountingPeriod(prisma: PrismaClient, input: CreateAccountingPeriodInput): Promise<AccountingPeriod> {
  if (!input.label.trim()) {
    throw new AccountingPeriodError("A label is required");
  }
  if (input.endDate <= input.startDate) {
    throw new AccountingPeriodError("End date must be after the start date");
  }

  return prisma.accountingPeriod.create({
    data: { companyId: input.companyId, label: input.label.trim(), startDate: input.startDate, endDate: input.endDate },
  });
}

export async function listCompanyAccountingPeriods(prisma: PrismaClient, companyId: string): Promise<AccountingPeriod[]> {
  return prisma.accountingPeriod.findMany({ where: { companyId }, orderBy: { endDate: "desc" } });
}

/** Marks (or un-marks) that the company told HMRC they intend to claim for this period. */
export async function setClaimNotified(prisma: PrismaClient, params: { id: string; notified: boolean }): Promise<AccountingPeriod> {
  return prisma.accountingPeriod.update({
    where: { id: params.id },
    data: { claimNotifiedAt: params.notified ? new Date() : null },
  });
}
