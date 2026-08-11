-- Wipe and restart (BOARD-PLAN.md Phase 0 decision #5). Confirmed
-- explicitly by the product owner: everything in the database at the
-- time of this migration is pre-launch test/smoke data. Truncating User
-- and Company with CASCADE clears every dependent row (Membership,
-- Invitation, Project, Xero connection/mirror, Subscription, and
-- everything the DROP TABLEs below would otherwise orphan) in one shot —
-- this also sidesteps the MembershipRole enum swap below failing on rows
-- that still use a value ('ADMIN', 'FINANCE_APPROVER') that no longer
-- exists in the new enum.
TRUNCATE "User", "Company" RESTART IDENTITY CASCADE;

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('LEAD', 'CONTRIBUTOR', 'ADVISER');

-- CreateEnum
CREATE TYPE "UncertaintyOutcome" AS ENUM ('OPEN', 'RESOLVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SubmissionBasis" AS ENUM ('ESTIMATED', 'TRACKED');

-- CreateEnum
CREATE TYPE "UncertaintyNoteType" AS ENUM ('ATTEMPT', 'BLOCKER', 'FAILED_ATTEMPT', 'RESOLUTION', 'NO_PROGRESS');

-- AlterEnum
BEGIN;
CREATE TYPE "MembershipRole_new" AS ENUM ('OWNER', 'FINANCE', 'LEAD', 'CONTRIBUTOR', 'ADVISER');
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "MembershipRole_new" USING ("role"::text::"MembershipRole_new");
ALTER TABLE "Invitation" ALTER COLUMN "role" TYPE "MembershipRole_new" USING ("role"::text::"MembershipRole_new");
ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_old";
ALTER TYPE "MembershipRole_new" RENAME TO "MembershipRole";
DROP TYPE "public"."MembershipRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_approverId_fkey";

-- DropForeignKey
ALTER TABLE "CostAllocation" DROP CONSTRAINT "CostAllocation_authorId_fkey";

-- DropForeignKey
ALTER TABLE "CostAllocation" DROP CONSTRAINT "CostAllocation_manualCostLineId_fkey";

-- DropForeignKey
ALTER TABLE "CostAllocation" DROP CONSTRAINT "CostAllocation_projectId_fkey";

-- DropForeignKey
ALTER TABLE "CostAllocation" DROP CONSTRAINT "CostAllocation_supersedes_fkey";

-- DropForeignKey
ALTER TABLE "CostAllocation" DROP CONSTRAINT "CostAllocation_xeroJournalLineId_fkey";

-- DropForeignKey
ALTER TABLE "EvidenceAttachment" DROP CONSTRAINT "EvidenceAttachment_evidenceEntryId_fkey";

-- DropForeignKey
ALTER TABLE "EvidenceEntry" DROP CONSTRAINT "EvidenceEntry_authorId_fkey";

-- DropForeignKey
ALTER TABLE "EvidenceEntry" DROP CONSTRAINT "EvidenceEntry_projectId_fkey";

-- DropForeignKey
ALTER TABLE "EvidenceEntry" DROP CONSTRAINT "EvidenceEntry_supersedes_fkey";

-- DropForeignKey
ALTER TABLE "PeriodSnapshot" DROP CONSTRAINT "PeriodSnapshot_accountingPeriodId_fkey";

-- DropForeignKey
ALTER TABLE "PeriodSnapshot" DROP CONSTRAINT "PeriodSnapshot_generatedById_fkey";

-- DropForeignKey
ALTER TABLE "PeriodSnapshot" DROP CONSTRAINT "PeriodSnapshot_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_authorId_fkey";

-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_personId_fkey";

-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_supersedes_fkey";

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "canViewCosts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "description" TEXT;

-- DropTable
DROP TABLE "Approval";

-- DropTable
DROP TABLE "CostAllocation";

-- DropTable
DROP TABLE "EvidenceAttachment";

-- DropTable
DROP TABLE "EvidenceEntry";

-- DropTable
DROP TABLE "PeriodSnapshot";

-- DropTable
DROP TABLE "TimeEntry";

-- DropEnum
DROP TYPE "ApprovalDecision";

-- DropEnum
DROP TYPE "ApprovalTargetType";

-- DropEnum
DROP TYPE "CostAllocationSource";

-- DropEnum
DROP TYPE "EvidenceEntryType";

-- DropEnum
DROP TYPE "TimeEntryBasis";

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Uncertainty" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "baseline" TEXT NOT NULL,
    "raisedWeek" TEXT NOT NULL,
    "resolvedWeek" TEXT,
    "outcome" "UncertaintyOutcome" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Uncertainty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklySubmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "basis" "SubmissionBasis" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRetrospective" BOOLEAN NOT NULL,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "WeeklySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UncertaintyNote" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "uncertaintyId" TEXT NOT NULL,
    "type" "UncertaintyNoteType" NOT NULL,
    "body" TEXT NOT NULL,
    "minutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UncertaintyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amendment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT,
    "submissionId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Amendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedAllocation" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "uncertaintyId" TEXT NOT NULL,
    "userId" TEXT,
    "weekKey" TEXT NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hourlyRateMinorUnits" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectCost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uncertaintyId" TEXT,
    "description" TEXT NOT NULL,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "date" TIMESTAMP(3) NOT NULL,
    "enteredById" TEXT NOT NULL,
    "xeroJournalLineId" TEXT,
    "manualCostLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Uncertainty_projectId_idx" ON "Uncertainty"("projectId");

-- CreateIndex
CREATE INDEX "WeeklySubmission_companyId_weekKey_idx" ON "WeeklySubmission"("companyId", "weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySubmission_projectId_userId_weekKey_key" ON "WeeklySubmission"("projectId", "userId", "weekKey");

-- CreateIndex
CREATE INDEX "UncertaintyNote_uncertaintyId_idx" ON "UncertaintyNote"("uncertaintyId");

-- CreateIndex
CREATE INDEX "UncertaintyNote_submissionId_idx" ON "UncertaintyNote"("submissionId");

-- CreateIndex
CREATE INDEX "Amendment_noteId_idx" ON "Amendment"("noteId");

-- CreateIndex
CREATE INDEX "Amendment_submissionId_idx" ON "Amendment"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_projectId_versionNumber_key" ON "PlanVersion"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "PlannedAllocation_planVersionId_idx" ON "PlannedAllocation"("planVersionId");

-- CreateIndex
CREATE INDEX "PlannedAllocation_uncertaintyId_weekKey_idx" ON "PlannedAllocation"("uncertaintyId", "weekKey");

-- CreateIndex
CREATE INDEX "Rate_userId_effectiveFrom_idx" ON "Rate"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "DirectCost_projectId_idx" ON "DirectCost"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Uncertainty" ADD CONSTRAINT "Uncertainty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklySubmission" ADD CONSTRAINT "WeeklySubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklySubmission" ADD CONSTRAINT "WeeklySubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklySubmission" ADD CONSTRAINT "WeeklySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UncertaintyNote" ADD CONSTRAINT "UncertaintyNote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "WeeklySubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UncertaintyNote" ADD CONSTRAINT "UncertaintyNote_uncertaintyId_fkey" FOREIGN KEY ("uncertaintyId") REFERENCES "Uncertainty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amendment" ADD CONSTRAINT "Amendment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UncertaintyNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amendment" ADD CONSTRAINT "Amendment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAllocation" ADD CONSTRAINT "PlannedAllocation_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAllocation" ADD CONSTRAINT "PlannedAllocation_uncertaintyId_fkey" FOREIGN KEY ("uncertaintyId") REFERENCES "Uncertainty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAllocation" ADD CONSTRAINT "PlannedAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCost" ADD CONSTRAINT "DirectCost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCost" ADD CONSTRAINT "DirectCost_uncertaintyId_fkey" FOREIGN KEY ("uncertaintyId") REFERENCES "Uncertainty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCost" ADD CONSTRAINT "DirectCost_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCost" ADD CONSTRAINT "DirectCost_xeroJournalLineId_fkey" FOREIGN KEY ("xeroJournalLineId") REFERENCES "XeroJournalLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCost" ADD CONSTRAINT "DirectCost_manualCostLineId_fkey" FOREIGN KEY ("manualCostLineId") REFERENCES "ManualCostLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CheckConstraint: Amendment references exactly one of noteId/submissionId
ALTER TABLE "Amendment" ADD CONSTRAINT "Amendment_exactly_one_target"
  CHECK (
    ("noteId" IS NOT NULL AND "submissionId" IS NULL) OR
    ("noteId" IS NULL AND "submissionId" IS NOT NULL)
  );

-- CheckConstraint: DirectCost traces to at most one Xero/manual source
ALTER TABLE "DirectCost" ADD CONSTRAINT "DirectCost_at_most_one_source"
  CHECK (NOT ("xeroJournalLineId" IS NOT NULL AND "manualCostLineId" IS NOT NULL));

-- Append-only enforcement -------------------------------------------------
-- Reuses reject_update_delete() from the evidence_model migration for
-- tables that are unconditionally insert-only (never touched again once
-- written), and adds two conditional variants for tables whose
-- immutability only kicks in once a lock/supersession state is reached —
-- see the header comment in schema.prisma for which rule applies where.

CREATE TRIGGER amendment_append_only
  BEFORE UPDATE OR DELETE ON "Amendment"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

CREATE TRIGGER planned_allocation_append_only
  BEFORE UPDATE OR DELETE ON "PlannedAllocation"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

-- WeeklySubmission: mutable until lockedAt is set. Once locked, the row
-- is frozen with exactly one sanctioned exception: finance unlocking it
-- (BOARD-PLAN.md Phase 4.3) — an UPDATE that changes lockedAt and nothing
-- else. Any other change while locked, and DELETE at any time once
-- locked, are rejected. (The transition that *sets* lockedAt in the
-- first place is simply an ordinary update on an unlocked row, so it's
-- not special-cased here.)
CREATE OR REPLACE FUNCTION reject_update_delete_if_locked() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."lockedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'append-only violation: DELETE on table % is not permitted once locked (row id: %)',
        TG_TABLE_NAME, OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."lockedAt" IS NOT NULL THEN
    IF NEW."companyId" IS DISTINCT FROM OLD."companyId"
      OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
      OR NEW."userId" IS DISTINCT FROM OLD."userId"
      OR NEW."weekKey" IS DISTINCT FROM OLD."weekKey"
      OR NEW."minutes" IS DISTINCT FROM OLD."minutes"
      OR NEW."basis" IS DISTINCT FROM OLD."basis"
      OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
      OR NEW."isRetrospective" IS DISTINCT FROM OLD."isRetrospective"
    THEN
      RAISE EXCEPTION 'append-only violation: UPDATE on table % is not permitted once locked, except unlocking it (row id: %)',
        TG_TABLE_NAME, OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_submission_lock_guard
  BEFORE UPDATE OR DELETE ON "WeeklySubmission"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete_if_locked();

-- UncertaintyNote has no lock state of its own — it inherits its parent
-- WeeklySubmission's. A note can only be touched while its submission is
-- still unlocked; once the submission locks, corrections must go through
-- Amendment instead.
CREATE OR REPLACE FUNCTION reject_update_delete_if_submission_locked() RETURNS TRIGGER AS $$
DECLARE
  submission_locked BOOLEAN;
BEGIN
  SELECT "lockedAt" IS NOT NULL INTO submission_locked
  FROM "WeeklySubmission"
  WHERE id = OLD."submissionId";

  IF submission_locked THEN
    RAISE EXCEPTION 'append-only violation: % on table % is not permitted once the parent submission is locked (row id: %)',
      TG_OP, TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uncertainty_note_lock_guard
  BEFORE UPDATE OR DELETE ON "UncertaintyNote"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete_if_submission_locked();

-- PlanVersion: mutable until supersededAt is set (the one allowed
-- transition is a later revision setting it), then frozen — old versions
-- "stay queryable forever" unchanged.
CREATE OR REPLACE FUNCTION reject_update_delete_if_superseded() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."supersededAt" IS NOT NULL THEN
    RAISE EXCEPTION 'append-only violation: % on table % is not permitted once superseded (row id: %)',
      TG_OP, TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_version_supersession_guard
  BEFORE UPDATE OR DELETE ON "PlanVersion"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete_if_superseded();
