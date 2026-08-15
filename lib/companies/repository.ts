import type { Company, PrismaClient } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/lib/locking/audit";

export interface UpdateCompanyAifDetailsInput {
  companyId: string;
  actorId: string;
  utr?: string | null;
  seniorOfficerName?: string | null;
  seniorOfficerRole?: string | null;
}

/** Only the fields present in `input` are touched. Logs before/after to AuditLog. */
export async function updateCompanyAifDetails(prisma: PrismaClient, input: UpdateCompanyAifDetailsInput): Promise<Company> {
  const { companyId, actorId, ...data } = input;
  const before = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const after = await prisma.company.update({ where: { id: companyId }, data });

  await writeAuditLog(prisma, {
    companyId,
    actorId,
    action: "company:update",
    entityType: "Company",
    entityId: companyId,
    before: Object.fromEntries(Object.keys(data).map((key) => [key, before[key as keyof Company]])),
    after: Object.fromEntries(Object.keys(data).map((key) => [key, after[key as keyof Company]])),
  });

  return after;
}
