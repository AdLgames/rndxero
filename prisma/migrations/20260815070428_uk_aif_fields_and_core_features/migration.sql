-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('UNDECIDED', 'QUALIFYING', 'NON_QUALIFYING');

-- CreateEnum
CREATE TYPE "DirectCostCategory" AS ENUM ('CONSUMABLES', 'SOFTWARE_LICENCE', 'CLOUD_COMPUTING', 'SUBCONTRACTOR', 'EPW', 'CLINICAL_TRIAL_VOLUNTEERS', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectStatus" ADD VALUE 'PLANNED';
ALTER TYPE "ProjectStatus" ADD VALUE 'PAUSED';

-- AlterEnum
ALTER TYPE "WorkerCostCategory" ADD VALUE 'QUALIFYING_INDIRECT';

-- AlterTable
ALTER TABLE "AccountingPeriod" ADD COLUMN     "claimNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "seniorOfficerName" TEXT,
ADD COLUMN     "seniorOfficerRole" TEXT,
ADD COLUMN     "utr" TEXT;

-- AlterTable
ALTER TABLE "DirectCost" ADD COLUMN     "category" "DirectCostCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "isOverseas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSubsidised" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "advanceSought" TEXT,
ADD COLUMN     "fieldOfScienceOrTechnology" TEXT,
ADD COLUMN     "qualificationStatus" "QualificationStatus" NOT NULL DEFAULT 'UNDECIDED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubmissionComment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionComment_submissionId_idx" ON "SubmissionComment"("submissionId");

-- AddForeignKey
ALTER TABLE "SubmissionComment" ADD CONSTRAINT "SubmissionComment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "WeeklySubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionComment" ADD CONSTRAINT "SubmissionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only, same as Amendment/AuditLog/PlannedAllocation: a comment is
-- never edited or silently removed, just like the rest of the
-- evidence-adjacent record. Reuses the reject_update_delete() function
-- already defined by the board_foundation migration.
CREATE TRIGGER submission_comment_append_only
  BEFORE UPDATE OR DELETE ON "SubmissionComment"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();
