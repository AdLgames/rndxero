import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getProjectClaimPack } from "@/lib/export/pack";
import { createPlanVersion } from "@/lib/plan/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("getProjectClaimPack (integration)", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;
  let uncertaintyId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Amendment", "AuditLog", "Rate", "PlannedAllocation", "PlanVersion", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "ProjectCompetentProfessional", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({
      data: {
        companyId,
        name: "Widget Engine",
        startDate: new Date("2026-01-01"),
        competentProfessionals: { create: [{ name: "Dr. Ada Lovelace" }] },
      },
    });
    projectId = project.id;
    const uncertainty = await prisma.uncertainty.create({
      data: { projectId, title: "Will the cache scale?", baseline: "Unknown at 10x load", raisedWeek: "2026-W28" },
    });
    uncertaintyId = uncertainty.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Amendment", "AuditLog", "Rate", "PlannedAllocation", "PlanVersion", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "ProjectCompetentProfessional", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("includes project summary with competent professionals", async () => {
    const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: false });
    expect(pack.project.name).toBe("Widget Engine");
    expect(pack.project.competentProfessionals).toEqual(["Dr. Ada Lovelace"]);
  });

  it("builds a chronological narrative per uncertainty, including a locked note and its amendment", async () => {
    const submission = await prisma.weeklySubmission.create({
      data: {
        companyId,
        projectId,
        userId,
        weekKey: "2026-W28",
        minutes: 600,
        basis: "TRACKED",
        isRetrospective: false,
        lockedAt: new Date("2026-08-01"),
      },
    });
    const note = await prisma.uncertaintyNote.create({
      data: { submissionId: submission.id, uncertaintyId, type: "FAILED_ATTEMPT", body: "LRU thrashed under load", minutes: 300 },
    });
    await prisma.amendment.create({ data: { noteId: note.id, authorId: userId, body: "Clarified: it was the eviction policy specifically" } });

    const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: false });
    const uncertainty = pack.uncertainties.find((u) => u.id === uncertaintyId)!;
    expect(uncertainty.chronology).toHaveLength(1);
    expect(uncertainty.chronology[0]).toMatchObject({ type: "FAILED_ATTEMPT", body: "LRU thrashed under load", locked: true, minutes: 300 });
    expect(uncertainty.chronology[0].amendments).toHaveLength(1);
    expect(uncertainty.chronology[0].amendments[0].body).toBe("Clarified: it was the eviction policy specifically");
    expect(uncertainty.totalMinutes).toBe(300);
  });

  it("orders chronology entries by week", async () => {
    const s1 = await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W28", minutes: 60, basis: "ESTIMATED", isRetrospective: false },
    });
    const s2 = await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W29", minutes: 60, basis: "ESTIMATED", isRetrospective: false },
    });
    await prisma.uncertaintyNote.create({ data: { submissionId: s2.id, uncertaintyId, type: "ATTEMPT", body: "second" } });
    await prisma.uncertaintyNote.create({ data: { submissionId: s1.id, uncertaintyId, type: "ATTEMPT", body: "first" } });

    const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: false });
    const uncertainty = pack.uncertainties.find((u) => u.id === uncertaintyId)!;
    expect(uncertainty.chronology.map((e) => e.body)).toEqual(["first", "second"]);
  });

  it("omits derived cost when includeCosts is false, even with a rate on file", async () => {
    await prisma.rate.create({ data: { companyId, userId, hourlyRateMinorUnits: 6000, effectiveFrom: new Date("2026-01-01") } });
    const submission = await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W28", minutes: 300, basis: "TRACKED", isRetrospective: false },
    });
    await prisma.uncertaintyNote.create({ data: { submissionId: submission.id, uncertaintyId, type: "ATTEMPT", body: "x", minutes: 300 } });

    const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: false });
    expect(pack.includesCosts).toBe(false);
    expect(pack.uncertainties[0].derivedCostMinorUnits).toBeNull();
    expect(pack.totals.derivedCostMinorUnits).toBeNull();
  });

  it("computes derived cost from the applicable rate when includeCosts is true", async () => {
    await prisma.rate.create({ data: { companyId, userId, hourlyRateMinorUnits: 6000, effectiveFrom: new Date("2026-01-01") } });
    const submission = await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W28", minutes: 300, basis: "TRACKED", isRetrospective: false },
    });
    // 5 hours tagged at £60/h = £300 = 30000 pence
    await prisma.uncertaintyNote.create({ data: { submissionId: submission.id, uncertaintyId, type: "ATTEMPT", body: "x", minutes: 300 } });

    const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: true });
    expect(pack.uncertainties[0].derivedCostMinorUnits).toBe(30000);
    expect(pack.totals.derivedCostMinorUnits).toBe(30000);
  });

  it("includes plan revision history and variance", async () => {
    await createPlanVersion(prisma, {
      projectId,
      createdById: userId,
      allocations: [{ uncertaintyId, weekKey: "2026-W28", plannedMinutes: 400 }],
    });
    await createPlanVersion(prisma, {
      projectId,
      createdById: userId,
      note: "Scope grew",
      allocations: [{ uncertaintyId, weekKey: "2026-W28", plannedMinutes: 600 }],
    });

    const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: false });
    expect(pack.planRevisions.map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(pack.planRevisions[0].supersededAt).not.toBeNull();
    expect(pack.planRevisions[1].note).toBe("Scope grew");
    expect(pack.totals.plannedMinutes).toBe(600);
    expect(pack.variance).toContainEqual({ uncertaintyTitle: "Will the cache scale?", weekKey: "2026-W28", plannedMinutes: 600, actualMinutes: 0, varianceMinutes: -600 });
  });

  it("includes integrity metadata with submission-level amendments", async () => {
    const submission = await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W28", minutes: 120, basis: "ESTIMATED", isRetrospective: true, lockedAt: new Date("2026-08-05") },
    });
    await prisma.amendment.create({ data: { submissionId: submission.id, authorId: userId, body: "Minutes should be 150" } });

    const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: false });
    expect(pack.integrity).toHaveLength(1);
    expect(pack.integrity[0]).toMatchObject({ weekKey: "2026-W28", minutes: 120, isRetrospective: true });
    expect(pack.integrity[0].lockedAt).not.toBeNull();
    expect(pack.integrity[0].amendments).toHaveLength(1);
    expect(pack.integrity[0].amendments[0].body).toBe("Minutes should be 150");
  });
});
