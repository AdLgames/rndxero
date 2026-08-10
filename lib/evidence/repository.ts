import type { EvidenceEntry, EvidenceEntryType, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Prisma-backed evidence repository. This module only ever calls
 * `create` — never `update` or `delete` — on evidence tables. That is a
 * defense-in-depth match for the database triggers added in the
 * `evidence_model` migration; either layer alone should be enough to stop
 * a mutation, but the point of append-only evidence is not relying on
 * only one layer being right forever.
 */

export interface RecordEvidenceEntryInput {
  projectId: string;
  type: EvidenceEntryType;
  body: string;
  authorId: string;
}

export async function recordEvidenceEntry(
  prisma: PrismaClient,
  input: RecordEvidenceEntryInput
): Promise<EvidenceEntry> {
  return prisma.evidenceEntry.create({ data: input });
}

export interface SupersedeEvidenceEntryInput {
  supersededId: string;
  type: EvidenceEntryType;
  body: string;
  authorId: string;
}

/**
 * Records a correction. The prior entry is left exactly as it was;
 * this only ever inserts a new row that points at it.
 */
export async function supersedeEvidenceEntry(
  prisma: PrismaClient,
  input: SupersedeEvidenceEntryInput
): Promise<EvidenceEntry> {
  const target = await prisma.evidenceEntry.findUnique({
    where: { id: input.supersededId },
  });
  if (!target) {
    throw new Error(`Cannot supersede unknown evidence entry ${input.supersededId}`);
  }
  return prisma.evidenceEntry.create({
    data: {
      projectId: target.projectId,
      type: input.type,
      body: input.body,
      authorId: input.authorId,
      supersedes: input.supersededId,
    },
  });
}

/** Full evidence log for a project, oldest first. */
export async function getProjectEvidenceLog(
  prisma: PrismaClient,
  projectId: string
): Promise<EvidenceEntry[]> {
  return prisma.evidenceEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
}
