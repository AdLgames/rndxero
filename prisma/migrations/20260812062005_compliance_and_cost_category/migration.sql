-- CreateEnum
CREATE TYPE "WorkerCostCategory" AS ENUM ('DIRECT_PAYE', 'SUBCONTRACTOR_CONNECTED', 'SUBCONTRACTOR_UNCONNECTED', 'EPW', 'CONSUMABLES');

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "costCategory" "WorkerCostCategory";

-- AlterTable
ALTER TABLE "UncertaintyNote" ADD COLUMN     "evidenceRef" TEXT;
