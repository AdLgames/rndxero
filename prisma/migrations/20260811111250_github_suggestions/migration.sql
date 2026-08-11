-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "GithubRepoLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubRepoLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "repoLinkId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "noteId" TEXT,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepoLink_repoFullName_key" ON "GithubRepoLink"("repoFullName");

-- CreateIndex
CREATE INDEX "Suggestion_projectId_status_idx" ON "Suggestion"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_repoLinkId_externalRef_key" ON "Suggestion"("repoLinkId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_noteId_key" ON "Suggestion"("noteId");

-- AddForeignKey
ALTER TABLE "GithubRepoLink" ADD CONSTRAINT "GithubRepoLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepoLink" ADD CONSTRAINT "GithubRepoLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_repoLinkId_fkey" FOREIGN KEY ("repoLinkId") REFERENCES "GithubRepoLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UncertaintyNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
