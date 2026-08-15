import type { Company, PrismaClient } from "@/lib/generated/prisma/client";

export interface UpdateCompanyAifDetailsInput {
  companyId: string;
  utr?: string | null;
  seniorOfficerName?: string | null;
  seniorOfficerRole?: string | null;
}

/** Only the fields present in `input` are touched. */
export async function updateCompanyAifDetails(prisma: PrismaClient, input: UpdateCompanyAifDetailsInput): Promise<Company> {
  const { companyId, ...data } = input;
  return prisma.company.update({ where: { id: companyId }, data });
}
