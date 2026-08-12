import type { PrismaClient } from "@/lib/generated/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Full-text retrieval over the ingested HMRC guidance corpus
 * (HmrcGuidanceChunk.searchVector, a generated tsvector — see the AI
 * provider migration). Deliberately not embeddings-based: retrieval must
 * work regardless of which AI provider a company brings, and not every
 * self-hosted OpenAI-compatible server exposes an embeddings endpoint.
 */
export interface GuidanceSearchResult {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  heading: string | null;
  content: string;
}

const DEFAULT_LIMIT = 6;

export async function searchGuidance(prisma: PrismaClient, query: string, limit = DEFAULT_LIMIT): Promise<GuidanceSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.$queryRaw<GuidanceSearchResult[]>(Prisma.sql`
    SELECT "id", "sourceTitle", "sourceUrl", "heading", "content"
    FROM "HmrcGuidanceChunk"
    WHERE "searchVector" @@ websearch_to_tsquery('english', ${trimmed})
    ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${trimmed})) DESC
    LIMIT ${limit}
  `);
}
