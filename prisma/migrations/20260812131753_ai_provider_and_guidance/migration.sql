-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "model" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HmrcGuidanceChunk" (
    "id" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HmrcGuidanceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_companyId_key" ON "AiProviderConfig"("companyId");

-- CreateIndex
CREATE INDEX "HmrcGuidanceChunk_sourceUrl_idx" ON "HmrcGuidanceChunk"("sourceUrl");

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Full-text retrieval for the HMRC Q&A feature. Generated column, not
-- Prisma-managed (Prisma has no generated-column support) — weights the
-- heading higher than the body so a question matching a section title
-- ranks that chunk above one that just happens to mention the term once
-- in passing. No embeddings/vector extension needed: this works with any
-- company's chosen AI provider, since retrieval never depends on it.
ALTER TABLE "HmrcGuidanceChunk" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("heading", '')), 'A') ||
    setweight(to_tsvector('english', "content"), 'B')
  ) STORED;

CREATE INDEX "HmrcGuidanceChunk_searchVector_idx" ON "HmrcGuidanceChunk" USING GIN ("searchVector");
