import type { DirectCost, DirectCostCategory, PrismaClient } from "@/lib/generated/prisma/client";

export interface CreateDirectCostInput {
  projectId: string;
  uncertaintyId?: string | null;
  description: string;
  category: DirectCostCategory;
  amountMinorUnits: number;
  currency?: string;
  isOverseas?: boolean;
  isSubsidised?: boolean;
  date: Date;
  enteredById: string;
}

export class DirectCostError extends Error {}

export async function createDirectCost(prisma: PrismaClient, input: CreateDirectCostInput): Promise<DirectCost> {
  if (!input.description.trim()) {
    throw new DirectCostError("A description is required");
  }
  if (!Number.isInteger(input.amountMinorUnits) || input.amountMinorUnits <= 0) {
    throw new DirectCostError("Amount must be a positive whole number of minor units");
  }

  return prisma.directCost.create({
    data: {
      projectId: input.projectId,
      uncertaintyId: input.uncertaintyId ?? null,
      description: input.description.trim(),
      category: input.category,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency ?? "GBP",
      isOverseas: input.isOverseas ?? false,
      isSubsidised: input.isSubsidised ?? false,
      date: input.date,
      enteredById: input.enteredById,
    },
  });
}

export async function listProjectDirectCosts(prisma: PrismaClient, projectId: string): Promise<DirectCost[]> {
  return prisma.directCost.findMany({ where: { projectId }, orderBy: { date: "desc" } });
}
