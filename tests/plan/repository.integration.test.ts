import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  computePlannedCostMinorUnits,
  createPlanVersion,
  getCurrentPlanVersion,
  getPlanVsActual,
  listPlanVersions,
  PlanError,
} from "@/lib/plan/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("plan repository (integration)", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;
  let uncertaintyId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Rate", "UncertaintyNote", "WeeklySubmission", "PlannedAllocation", "PlanVersion", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const user = await prisma.user.create({ data: { email: "lead@example.com", name: "Lead" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({
      data: { companyId, name: "Test Project", startDate: new Date() },
    });
    projectId = project.id;
    const uncertainty = await prisma.uncertainty.create({
      data: { projectId, title: "Will it scale?", baseline: "b", raisedWeek: "2026-W30" },
    });
    uncertaintyId = uncertainty.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Rate", "UncertaintyNote", "WeeklySubmission", "PlannedAllocation", "PlanVersion", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  describe("createPlanVersion", () => {
    it("creates version 1 without requiring a note", async () => {
      const plan = await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, userId, weekKey: "2026-W33", plannedMinutes: 300 }],
      });
      expect(plan.versionNumber).toBe(1);
      expect(plan.supersededAt).toBeNull();
      expect(plan.plannedAllocations).toHaveLength(1);
    });

    it("requires a note on a revision", async () => {
      await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 300 }],
      });

      await expect(
        createPlanVersion(prisma, {
          projectId,
          createdById: userId,
          allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 400 }],
        })
      ).rejects.toThrow(/note explaining the revision/);
    });

    it("supersedes the previous version on revision, old version stays queryable", async () => {
      const v1 = await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 300 }],
      });
      const v2 = await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        note: "Scope grew",
        allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 600 }],
      });

      const v1After = await prisma.planVersion.findUniqueOrThrow({ where: { id: v1.id } });
      expect(v1After.supersededAt).not.toBeNull();
      expect(v2.supersededAt).toBeNull();
      expect(v2.versionNumber).toBe(2);

      const all = await listPlanVersions(prisma, projectId);
      expect(all.map((v) => v.versionNumber)).toEqual([1, 2]);
    });

    it("rejects an empty allocation list", async () => {
      await expect(
        createPlanVersion(prisma, { projectId, createdById: userId, allocations: [] })
      ).rejects.toThrow(PlanError);
    });

    it("rejects non-positive planned minutes", async () => {
      await expect(
        createPlanVersion(prisma, {
          projectId,
          createdById: userId,
          allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 0 }],
        })
      ).rejects.toThrow(PlanError);
    });

    it("rejects a malformed week key", async () => {
      await expect(
        createPlanVersion(prisma, {
          projectId,
          createdById: userId,
          allocations: [{ uncertaintyId, weekKey: "not-a-week", plannedMinutes: 100 }],
        })
      ).rejects.toThrow();
    });
  });

  describe("getCurrentPlanVersion", () => {
    it("returns null when a project has never had a plan", async () => {
      expect(await getCurrentPlanVersion(prisma, projectId)).toBeNull();
    });

    it("returns the latest non-superseded version", async () => {
      await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 300 }],
      });
      await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        note: "revised",
        allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 500 }],
      });

      const current = await getCurrentPlanVersion(prisma, projectId);
      expect(current?.versionNumber).toBe(2);
      expect(current?.plannedAllocations[0].plannedMinutes).toBe(500);
    });
  });

  describe("getPlanVsActual", () => {
    it("combines planned allocations with actual note minutes per week", async () => {
      await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [
          { uncertaintyId, weekKey: "2026-W33", plannedMinutes: 300 },
          { uncertaintyId, weekKey: "2026-W34", plannedMinutes: 300 },
        ],
      });

      const submission = await prisma.weeklySubmission.create({
        data: {
          companyId,
          projectId,
          userId,
          weekKey: "2026-W33",
          minutes: 400,
          basis: "TRACKED",
          isRetrospective: false,
        },
      });
      await prisma.uncertaintyNote.create({
        data: { submissionId: submission.id, uncertaintyId, type: "ATTEMPT", body: "Tried X", minutes: 250 },
      });
      // A note with no minutes tagged shouldn't count as actual 0-and-present, just absent from the actual total.
      await prisma.uncertaintyNote.create({
        data: { submissionId: submission.id, uncertaintyId, type: "NO_PROGRESS", body: "Nothing else" },
      });

      const variance = await getPlanVsActual(prisma, { projectId, uncertaintyId });
      expect(variance).toEqual([
        { weekKey: "2026-W33", plannedMinutes: 300, actualMinutes: 250, varianceMinutes: -50 },
        { weekKey: "2026-W34", plannedMinutes: 300, actualMinutes: 0, varianceMinutes: -300 },
      ]);
    });

    it("includes weeks with actuals but no plan", async () => {
      const submission = await prisma.weeklySubmission.create({
        data: {
          companyId,
          projectId,
          userId,
          weekKey: "2026-W40",
          minutes: 120,
          basis: "ESTIMATED",
          isRetrospective: false,
        },
      });
      await prisma.uncertaintyNote.create({
        data: { submissionId: submission.id, uncertaintyId, type: "RESOLUTION", body: "Fixed", minutes: 120 },
      });

      const variance = await getPlanVsActual(prisma, { projectId, uncertaintyId });
      expect(variance).toEqual([{ weekKey: "2026-W40", plannedMinutes: 0, actualMinutes: 120, varianceMinutes: 120 }]);
    });
  });

  describe("computePlannedCostMinorUnits", () => {
    it("is zero when no allocation has an assigned user", async () => {
      const plan = await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, weekKey: "2026-W33", plannedMinutes: 300 }],
      });
      expect(await computePlannedCostMinorUnits(prisma, { companyId, planVersion: plan })).toBe(0);
    });

    it("applies the rate effective at the allocation's week", async () => {
      await prisma.rate.create({
        data: { companyId, userId, hourlyRateMinorUnits: 6000, effectiveFrom: new Date("2026-01-01") },
      });
      const plan = await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, userId, weekKey: "2026-W33", plannedMinutes: 300 }], // 5 hours
      });
      // 5h * £60.00/h = £300.00 = 30000 pence
      expect(await computePlannedCostMinorUnits(prisma, { companyId, planVersion: plan })).toBe(30000);
    });

    it("skips allocations with no rate covering that week", async () => {
      await prisma.rate.create({
        data: { companyId, userId, hourlyRateMinorUnits: 6000, effectiveFrom: new Date("2027-01-01") },
      });
      const plan = await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, userId, weekKey: "2026-W33", plannedMinutes: 300 }],
      });
      expect(await computePlannedCostMinorUnits(prisma, { companyId, planVersion: plan })).toBe(0);
    });

    it("uses the most recent applicable rate when a user has more than one", async () => {
      await prisma.rate.create({
        data: { companyId, userId, hourlyRateMinorUnits: 4000, effectiveFrom: new Date("2025-01-01") },
      });
      await prisma.rate.create({
        data: { companyId, userId, hourlyRateMinorUnits: 8000, effectiveFrom: new Date("2026-01-01") },
      });
      const plan = await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [{ uncertaintyId, userId, weekKey: "2026-W33", plannedMinutes: 60 }], // 1 hour
      });
      expect(await computePlannedCostMinorUnits(prisma, { companyId, planVersion: plan })).toBe(8000);
    });
  });
});
