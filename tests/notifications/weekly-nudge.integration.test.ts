import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getNudgeCandidates } from "@/lib/notifications/weekly-nudge";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("getNudgeCandidates (integration)", () => {
  let companyId: string;
  let projectId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "WeeklySubmission", "ProjectMember", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({ data: { companyId, name: "Widget Engine", startDate: new Date() } });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "WeeklySubmission", "ProjectMember", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("includes a member who hasn't submitted the given week", async () => {
    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    await prisma.projectMember.create({ data: { projectId, userId: user.id, role: "CONTRIBUTOR" } });

    const candidates = await getNudgeCandidates(prisma, "2026-W33");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ userId: user.id, email: "eng@example.com", missingProjectNames: ["Widget Engine"] });
  });

  it("excludes a member who already submitted that week", async () => {
    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    await prisma.projectMember.create({ data: { projectId, userId: user.id, role: "CONTRIBUTOR" } });
    await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId: user.id, weekKey: "2026-W33", minutes: 60, basis: "ESTIMATED", isRetrospective: false },
    });

    expect(await getNudgeCandidates(prisma, "2026-W33")).toHaveLength(0);
  });

  it("excludes Advisers entirely, submitted or not", async () => {
    const user = await prisma.user.create({ data: { email: "adviser@example.com", name: "Adviser" } });
    await prisma.projectMember.create({ data: { projectId, userId: user.id, role: "ADVISER" } });

    expect(await getNudgeCandidates(prisma, "2026-W33")).toHaveLength(0);
  });

  it("excludes members of a non-ACTIVE project", async () => {
    const abandoned = await prisma.project.create({ data: { companyId, name: "Shelved", startDate: new Date(), status: "ABANDONED" } });
    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    await prisma.projectMember.create({ data: { projectId: abandoned.id, userId: user.id, role: "CONTRIBUTOR" } });

    expect(await getNudgeCandidates(prisma, "2026-W33")).toHaveLength(0);
  });

  it("groups multiple missing projects for the same person into one candidate", async () => {
    const project2 = await prisma.project.create({ data: { companyId, name: "Payments Sync", startDate: new Date() } });
    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    await prisma.projectMember.create({ data: { projectId, userId: user.id, role: "CONTRIBUTOR" } });
    await prisma.projectMember.create({ data: { projectId: project2.id, userId: user.id, role: "CONTRIBUTOR" } });

    const candidates = await getNudgeCandidates(prisma, "2026-W33");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].missingProjectNames.sort()).toEqual(["Payments Sync", "Widget Engine"]);
  });

  it("only lists the still-missing project when one of two is already submitted", async () => {
    const project2 = await prisma.project.create({ data: { companyId, name: "Payments Sync", startDate: new Date() } });
    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    await prisma.projectMember.create({ data: { projectId, userId: user.id, role: "CONTRIBUTOR" } });
    await prisma.projectMember.create({ data: { projectId: project2.id, userId: user.id, role: "CONTRIBUTOR" } });
    await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId: user.id, weekKey: "2026-W33", minutes: 60, basis: "ESTIMATED", isRetrospective: false },
    });

    const candidates = await getNudgeCandidates(prisma, "2026-W33");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].missingProjectNames).toEqual(["Payments Sync"]);
  });
});
