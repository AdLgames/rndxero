import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getPortfolioBoardData } from "@/lib/board/portfolio";
import { createPlanVersion } from "@/lib/plan/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE =
  'TRUNCATE "PlannedAllocation", "PlanVersion", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "ProjectMember", "Project", "Company", "User" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("getPortfolioBoardData (integration)", () => {
  let companyId: string;
  let projectId: string;
  let otherCompanyProjectId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const user = await prisma.user.create({ data: { email: "lead@example.com", name: "Lead" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const otherCompany = await prisma.company.create({ data: { name: "Other Co" } });

    const project = await prisma.project.create({
      data: { companyId, name: "Battery Thermal Model", startDate: new Date(), status: "ACTIVE", qualificationStatus: "QUALIFYING" },
    });
    projectId = project.id;
    await prisma.projectMember.create({ data: { projectId, userId, role: "LEAD" } });

    const otherProject = await prisma.project.create({ data: { companyId: otherCompany.id, name: "Elsewhere", startDate: new Date() } });
    otherCompanyProjectId = otherProject.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("returns one card per project with its status and qualification tag", async () => {
    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [projectId] });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ projectId, projectName: "Battery Thermal Model", status: "ACTIVE", qualificationStatus: "QUALIFYING" });
  });

  it("resolves the project lead's name as owner", async () => {
    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [projectId] });
    expect(cards[0].ownerName).toBe("Lead");
  });

  it("is null for a project with no lead assigned", async () => {
    const noLeadProject = await prisma.project.create({ data: { companyId, name: "No Lead Yet", startDate: new Date() } });
    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [noLeadProject.id] });
    expect(cards[0].ownerName).toBeNull();
  });

  it("sums logged minutes across all weekly submissions", async () => {
    await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W30", minutes: 120, basis: "TRACKED", isRetrospective: false },
    });
    await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W31", minutes: 180, basis: "TRACKED", isRetrospective: false },
    });
    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [projectId] });
    expect(cards[0].loggedMinutes).toBe(300);
  });

  it("sums planned minutes from the current plan version only", async () => {
    const uncertainty = await prisma.uncertainty.create({ data: { projectId, title: "u", baseline: "b", raisedWeek: "2026-W30" } });
    await createPlanVersion(prisma, {
      projectId,
      createdById: userId,
      allocations: [{ uncertaintyId: uncertainty.id, weekKey: "2026-W30", plannedMinutes: 300 }],
    });
    await createPlanVersion(prisma, {
      projectId,
      createdById: userId,
      allocations: [{ uncertaintyId: uncertainty.id, weekKey: "2026-W30", plannedMinutes: 600 }],
      note: "Revised estimate",
    });

    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [projectId] });
    expect(cards[0].plannedMinutes).toBe(600);
  });

  it("counts only open uncertainties as open challenges", async () => {
    await prisma.uncertainty.create({ data: { projectId, title: "open one", baseline: "b", raisedWeek: "2026-W30", outcome: "OPEN" } });
    await prisma.uncertainty.create({
      data: { projectId, title: "resolved one", baseline: "b", raisedWeek: "2026-W30", outcome: "RESOLVED" },
    });
    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [projectId] });
    expect(cards[0].openChallengeCount).toBe(1);
  });

  it("excludes projects outside the requested company even if the id is passed", async () => {
    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [projectId, otherCompanyProjectId] });
    expect(cards.map((c) => c.projectId)).toEqual([projectId]);
  });

  it("returns an empty array for an empty projectIds list", async () => {
    const cards = await getPortfolioBoardData(prisma, { companyId, projectIds: [] });
    expect(cards).toEqual([]);
  });
});
