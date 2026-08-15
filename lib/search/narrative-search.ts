import type { PrismaClient, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Full-text retrieval over narrative entries — "show me every failed
 * attempt on Project X" — scoped to the projects the searching user can
 * actually see (callers must pass `projectIds` from
 * lib/authz/service.ts's listAccessibleProjectIds, never an unscoped
 * company-wide query). Same Postgres FTS approach as
 * lib/ai/guidance-search.ts: a generated tsvector column, no embeddings.
 */
export interface NarrativeSearchResult {
  noteId: string;
  type: UncertaintyNoteType;
  body: string;
  evidenceRef: string | null;
  createdAt: Date;
  weekKey: string;
  projectId: string;
  projectName: string;
  uncertaintyId: string;
  uncertaintyTitle: string;
  authorName: string | null;
}

const DEFAULT_LIMIT = 40;

export async function searchNarrative(
  prisma: PrismaClient,
  params: { projectIds: string[]; query: string; type?: UncertaintyNoteType; limit?: number }
): Promise<NarrativeSearchResult[]> {
  const trimmed = params.query.trim();
  if (!trimmed || params.projectIds.length === 0) return [];

  const typeFilter = params.type ? Prisma.sql`AND n."type" = ${params.type}::"UncertaintyNoteType"` : Prisma.empty;

  return prisma.$queryRaw<NarrativeSearchResult[]>(Prisma.sql`
    SELECT
      n."id" AS "noteId",
      n."type",
      n."body",
      n."evidenceRef",
      n."createdAt",
      s."weekKey",
      p."id" AS "projectId",
      p."name" AS "projectName",
      u."id" AS "uncertaintyId",
      u."title" AS "uncertaintyTitle",
      author."name" AS "authorName"
    FROM "UncertaintyNote" n
    JOIN "Uncertainty" u ON u."id" = n."uncertaintyId"
    JOIN "Project" p ON p."id" = u."projectId"
    JOIN "WeeklySubmission" s ON s."id" = n."submissionId"
    JOIN "User" author ON author."id" = s."userId"
    WHERE n."searchVector" @@ websearch_to_tsquery('english', ${trimmed})
      AND p."id" IN (${Prisma.join(params.projectIds)})
      ${typeFilter}
    ORDER BY ts_rank(n."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC
    LIMIT ${params.limit ?? DEFAULT_LIMIT}
  `);
}
