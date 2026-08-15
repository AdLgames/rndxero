import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { searchNarrative } from "@/lib/search/narrative-search";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE = 'TRUNCATE "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("searchNarrative (integration)", () => {
  let companyId: string;
  let projectAId: string;
  let projectBId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const user = await prisma.user.create({ data: { email: "dev@example.com", name: "Dev" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const projectA = await prisma.project.create({ data: { companyId, name: "Project A", startDate: new Date() } });
    projectAId = projectA.id;
    const projectB = await prisma.project.create({ data: { companyId, name: "Project B", startDate: new Date() } });
    projectBId = projectB.id;

    const uncertaintyA = await prisma.uncertainty.create({ data: { projectId: projectAId, title: "Caching layer", baseline: "b", raisedWeek: "2026-W30" } });
    const uncertaintyB = await prisma.uncertainty.create({ data: { projectId: projectBId, title: "Auth flow", baseline: "b", raisedWeek: "2026-W30" } });

    const submissionA = await prisma.weeklySubmission.create({
      data: { companyId, projectId: projectAId, userId, weekKey: "2026-W30", minutes: 60, basis: "TRACKED", isRetrospective: false },
    });
    const submissionB = await prisma.weeklySubmission.create({
      data: { companyId, projectId: projectBId, userId, weekKey: "2026-W30", minutes: 60, basis: "TRACKED", isRetrospective: false },
    });

    await prisma.uncertaintyNote.create({
      data: { submissionId: submissionA.id, uncertaintyId: uncertaintyA.id, type: "FAILED_ATTEMPT", body: "Redis eviction kept dropping session cache under load" },
    });
    await prisma.uncertaintyNote.create({
      data: { submissionId: submissionA.id, uncertaintyId: uncertaintyA.id, type: "RESOLUTION", body: "Switched eviction policy and cache is now stable" },
    });
    await prisma.uncertaintyNote.create({
      data: { submissionId: submissionB.id, uncertaintyId: uncertaintyB.id, type: "ATTEMPT", body: "Tried OAuth refresh token rotation" },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("finds notes matching the query text", async () => {
    const results = await searchNarrative(prisma, { projectIds: [projectAId, projectBId], query: "cache" });
    expect(results.map((r) => r.noteId).length).toBe(2);
    expect(results.every((r) => r.projectId === projectAId)).toBe(true);
  });

  it("scopes to only the given project ids", async () => {
    const results = await searchNarrative(prisma, { projectIds: [projectBId], query: "cache" });
    expect(results).toHaveLength(0);
  });

  it("filters by note type", async () => {
    const results = await searchNarrative(prisma, { projectIds: [projectAId, projectBId], query: "cache", type: "FAILED_ATTEMPT" });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("FAILED_ATTEMPT");
  });

  it("returns nothing for an empty projectIds list", async () => {
    const results = await searchNarrative(prisma, { projectIds: [], query: "cache" });
    expect(results).toHaveLength(0);
  });

  it("returns nothing for a blank query", async () => {
    const results = await searchNarrative(prisma, { projectIds: [projectAId], query: "   " });
    expect(results).toHaveLength(0);
  });

  it("includes project, uncertainty, and author context", async () => {
    const results = await searchNarrative(prisma, { projectIds: [projectBId], query: "OAuth" });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      projectName: "Project B",
      uncertaintyTitle: "Auth flow",
      authorName: "Dev",
      weekKey: "2026-W30",
    });
  });
});
