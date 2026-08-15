import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildCompanyContext, buildProjectContext } from "@/lib/ai/context";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE = 'TRUNCATE "UncertaintyNote", "WeeklySubmission", "Uncertainty", "ProjectCompetentProfessional", "Project", "Company", "User" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("buildProjectContext (integration)", () => {
  let projectId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const user = await prisma.user.create({ data: { email: "lead@example.com", name: "Lead" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: "Adaptive Gripper Control",
        description: "A robotic gripper that adapts grip force in real time.",
        startDate: new Date("2026-01-01"),
        competentProfessionals: { create: [{ name: "Dr. Priya Kapoor" }] },
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("includes the project name, description, and named competent professionals", async () => {
    const context = await buildProjectContext(prisma, projectId);
    expect(context).toContain("Adaptive Gripper Control");
    expect(context).toContain("A robotic gripper that adapts grip force in real time.");
    expect(context).toContain("Dr. Priya Kapoor");
  });

  it("flags a missing baseline", async () => {
    await prisma.uncertainty.create({ data: { projectId, title: "Grip force calibration", baseline: "", raisedWeek: "2026-W10" } });
    const context = await buildProjectContext(prisma, projectId);
    expect(context).toContain("MISSING — no baseline recorded");
  });

  it("counts notes missing a narrative or an evidence link", async () => {
    const uncertainty = await prisma.uncertainty.create({
      data: { projectId, title: "Grip force calibration", baseline: "Fixed grip force only.", raisedWeek: "2026-W10" },
    });
    const submission = await prisma.weeklySubmission.create({
      data: { companyId: (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).companyId, projectId, userId, weekKey: "2026-W10", minutes: 300, basis: "TRACKED", isRetrospective: false },
    });
    await prisma.uncertaintyNote.create({
      data: { submissionId: submission.id, uncertaintyId: uncertainty.id, type: "ATTEMPT", body: "Tried a PID controller with adaptive gain scheduling based on estimated payload mass.", evidenceRef: "https://github.com/example/pr/12" },
    });
    await prisma.uncertaintyNote.create({
      data: { submissionId: submission.id, uncertaintyId: uncertainty.id, type: "BLOCKER", body: "short", evidenceRef: null },
    });

    const context = await buildProjectContext(prisma, projectId);
    expect(context).toContain("2 logged note(s); 1 missing a substantive narrative; 1 missing a linked piece of evidence.");
  });

  it("notes when a project has no technical challenges recorded yet", async () => {
    const context = await buildProjectContext(prisma, projectId);
    expect(context).toContain("No technical challenges recorded yet");
  });
});

describe.skipIf(!hasDatabase)("buildCompanyContext (integration)", () => {
  let companyId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("lists projects with their status", async () => {
    await prisma.project.create({ data: { companyId, name: "Onboarding v2", startDate: new Date(), status: "ACTIVE" } });
    await prisma.project.create({ data: { companyId, name: "Legacy migration", startDate: new Date(), status: "COMPLETED" } });

    const context = await buildCompanyContext(prisma, companyId);
    expect(context).toContain("Onboarding v2 (ACTIVE)");
    expect(context).toContain("Legacy migration (COMPLETED)");
    expect(context).toContain("2 total, 1 active");
  });

  it("reports zero hours and expenditure for a company with no activity", async () => {
    const context = await buildCompanyContext(prisma, companyId);
    expect(context).toContain("Total hours logged: 0.0h");
    expect(context).toContain("Qualifying expenditure logged: £0");
  });
});
