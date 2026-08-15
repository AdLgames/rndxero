-- Full-text search over narrative entries ("show me every failed attempt on
-- Project X"). Generated column, not Prisma-managed (Prisma has no
-- generated-column support), same pattern as HmrcGuidanceChunk.searchVector.
ALTER TABLE "UncertaintyNote" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "body")) STORED;

CREATE INDEX "UncertaintyNote_searchVector_idx" ON "UncertaintyNote" USING GIN ("searchVector");
