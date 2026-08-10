import type { PrismaClient, TimeEntry, TimeEntryBasis } from "@/lib/generated/prisma/client";

/**
 * Prisma-backed time entry repository. Same append-only shape as
 * lib/evidence/repository.ts: only ever `create`, never `update`/`delete`
 * — the TimeEntry table has the same database trigger protection.
 */

export interface RecordTimeEntryInput {
  projectId: string;
  personId: string;
  periodStart: Date;
  periodEnd: Date;
  minutes: number;
  basis: TimeEntryBasis;
  authorId: string;
}

export async function recordTimeEntry(
  prisma: PrismaClient,
  input: RecordTimeEntryInput
): Promise<TimeEntry> {
  return prisma.timeEntry.create({ data: input });
}

export interface SupersedeTimeEntryInput {
  supersededId: string;
  minutes: number;
  basis: TimeEntryBasis;
  authorId: string;
}

export async function supersedeTimeEntry(
  prisma: PrismaClient,
  input: SupersedeTimeEntryInput
): Promise<TimeEntry> {
  const target = await prisma.timeEntry.findUnique({ where: { id: input.supersededId } });
  if (!target) {
    throw new Error(`Cannot supersede unknown time entry ${input.supersededId}`);
  }
  return prisma.timeEntry.create({
    data: {
      projectId: target.projectId,
      personId: target.personId,
      periodStart: target.periodStart,
      periodEnd: target.periodEnd,
      minutes: input.minutes,
      basis: input.basis,
      authorId: input.authorId,
      supersedes: input.supersededId,
    },
  });
}

export async function getProjectTimeLog(
  prisma: PrismaClient,
  projectId: string
): Promise<TimeEntry[]> {
  return prisma.timeEntry.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
}
