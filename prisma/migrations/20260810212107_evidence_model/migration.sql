-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'CONTRIBUTOR', 'FINANCE_APPROVER', 'ADVISER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "EvidenceEntryType" AS ENUM ('UNCERTAINTY_RAISED', 'APPROACH_ATTEMPTED', 'RESULT_OBSERVED', 'RESOLUTION', 'DECISION');

-- CreateEnum
CREATE TYPE "TimeEntryBasis" AS ENUM ('TIMESHEET', 'SAMPLED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "CostAllocationSource" AS ENUM ('XERO_JOURNAL_LINE', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "ApprovalTargetType" AS ENUM ('TIME_ENTRY', 'COST_ALLOCATION', 'PERIOD_SNAPSHOT');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'QUERIED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "xeroTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCompetentProfessional" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "ProjectCompetentProfessional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "EvidenceEntryType" NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "supersedes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAttachment" (
    "id" TEXT NOT NULL,
    "evidenceEntryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "basis" "TimeEntryBasis" NOT NULL,
    "authorId" TEXT NOT NULL,
    "supersedes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAllocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" "CostAllocationSource" NOT NULL,
    "xeroJournalLineId" TEXT,
    "manualCostLineId" TEXT,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "apportionmentBps" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "supersedes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "targetType" "ApprovalTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "comment" TEXT,
    "approverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroJournalLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "xeroJournalId" TEXT NOT NULL,
    "xeroJournalLineId" TEXT NOT NULL,
    "journalDate" TIMESTAMP(3) NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "description" TEXT,
    "netAmountMinor" INTEGER NOT NULL,
    "trackingCategory" TEXT,
    "trackingOption" TEXT,
    "sourceType" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroSyncCursor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lastJournalNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroSyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualCostImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualCostImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualCostLine" (
    "id" TEXT NOT NULL,
    "manualCostImportId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "description" TEXT,

    CONSTRAINT "ManualCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_xeroTenantId_key" ON "Company"("xeroTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCompetentProfessional_projectId_name_key" ON "ProjectCompetentProfessional"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_companyId_startDate_endDate_key" ON "AccountingPeriod"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceEntry_supersedes_key" ON "EvidenceEntry"("supersedes");

-- CreateIndex
CREATE INDEX "EvidenceEntry_projectId_createdAt_idx" ON "EvidenceEntry"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_supersedes_key" ON "TimeEntry"("supersedes");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_periodStart_idx" ON "TimeEntry"("projectId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "CostAllocation_supersedes_key" ON "CostAllocation"("supersedes");

-- CreateIndex
CREATE INDEX "CostAllocation_projectId_createdAt_idx" ON "CostAllocation"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_targetType_targetId_idx" ON "Approval"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodSnapshot_projectId_accountingPeriodId_key" ON "PeriodSnapshot"("projectId", "accountingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroConnection_companyId_key" ON "XeroConnection"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroConnection_tenantId_key" ON "XeroConnection"("tenantId");

-- CreateIndex
CREATE INDEX "XeroJournalLine_companyId_journalDate_idx" ON "XeroJournalLine"("companyId", "journalDate");

-- CreateIndex
CREATE UNIQUE INDEX "XeroJournalLine_companyId_xeroJournalLineId_key" ON "XeroJournalLine"("companyId", "xeroJournalLineId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroSyncCursor_companyId_key" ON "XeroSyncCursor"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompetentProfessional" ADD CONSTRAINT "ProjectCompetentProfessional_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompetentProfessional" ADD CONSTRAINT "ProjectCompetentProfessional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceEntry" ADD CONSTRAINT "EvidenceEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceEntry" ADD CONSTRAINT "EvidenceEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceEntry" ADD CONSTRAINT "EvidenceEntry_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "EvidenceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_evidenceEntryId_fkey" FOREIGN KEY ("evidenceEntryId") REFERENCES "EvidenceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "TimeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_xeroJournalLineId_fkey" FOREIGN KEY ("xeroJournalLineId") REFERENCES "XeroJournalLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_manualCostLineId_fkey" FOREIGN KEY ("manualCostLineId") REFERENCES "ManualCostLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "CostAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodSnapshot" ADD CONSTRAINT "PeriodSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodSnapshot" ADD CONSTRAINT "PeriodSnapshot_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodSnapshot" ADD CONSTRAINT "PeriodSnapshot_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XeroConnection" ADD CONSTRAINT "XeroConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualCostImport" ADD CONSTRAINT "ManualCostImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualCostLine" ADD CONSTRAINT "ManualCostLine_manualCostImportId_fkey" FOREIGN KEY ("manualCostImportId") REFERENCES "ManualCostImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only enforcement -----------------------------------------------
-- Evidence, time, cost, approval and snapshot records must never be
-- mutated or deleted once written (PLAN.md Phase 2). The application layer
-- (lib/evidence, lib/approvals) already only ever inserts, but that is not
-- sufficient on its own: a bug, a migration script, or a DBA running ad-hoc
-- SQL could silently rewrite history. This trigger makes that impossible
-- at the database level, which is the only place the guarantee actually
-- holds under an HMRC enquiry six years from now.

CREATE OR REPLACE FUNCTION reject_update_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation: % on table % is not permitted (row id: %)',
    TG_OP, TG_TABLE_NAME, COALESCE(OLD.id, 'unknown');
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_entry_append_only
  BEFORE UPDATE OR DELETE ON "EvidenceEntry"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

CREATE TRIGGER evidence_attachment_append_only
  BEFORE UPDATE OR DELETE ON "EvidenceAttachment"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

CREATE TRIGGER time_entry_append_only
  BEFORE UPDATE OR DELETE ON "TimeEntry"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

CREATE TRIGGER cost_allocation_append_only
  BEFORE UPDATE OR DELETE ON "CostAllocation"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

CREATE TRIGGER approval_append_only
  BEFORE UPDATE OR DELETE ON "Approval"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();

CREATE TRIGGER period_snapshot_append_only
  BEFORE UPDATE OR DELETE ON "PeriodSnapshot"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();
