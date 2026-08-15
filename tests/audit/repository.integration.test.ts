import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getProjectAuditTrail } from "@/lib/audit/repository";
import { writeAuditLog } from "@/lib/locking/audit";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE = 'TRUNCATE "AuditLog", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("getProjectAuditTrail (integration)", () => {
  let companyId: string;
  let projectId: string;
  let otherProjectId: string;
  let userId: string;
  let submissionId: string;
  let noteId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const user = await prisma.user.create({ data: { email: "lead@example.com", name: "Lead" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({ data: { companyId, name: "Project A", startDate: new Date() } });
    projectId = project.id;
    const other = await prisma.project.create({ data: { companyId, name: "Project B", startDate: new Date() } });
    otherProjectId = other.id;

    const uncertainty = await prisma.uncertainty.create({ data: { projectId, title: "u", baseline: "b", raisedWeek: "2026-W30" } });
    const submission = await prisma.weeklySubmission.create({
      data: { companyId, projectId, userId, weekKey: "2026-W30", minutes: 60, basis: "TRACKED", isRetrospective: false },
    });
    submissionId = submission.id;
    const note = await prisma.uncertaintyNote.create({
      data: { submissionId, uncertaintyId: uncertainty.id, type: "ATTEMPT", body: "tried something" },
    });
    noteId = note.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("includes entries tagged directly to the project", async () => {
    await writeAuditLog(prisma, { companyId, actorId: userId, action: "project:update", entityType: "Project", entityId: projectId });
    const trail = await getProjectAuditTrail(prisma, projectId);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ action: "project:update", entityType: "Project", actorName: "Lead" });
  });

  it("includes entries tagged to one of the project's submissions", async () => {
    await writeAuditLog(prisma, { companyId, actorId: userId, action: "submission:lock", entityType: "WeeklySubmission", entityId: submissionId });
    const trail = await getProjectAuditTrail(prisma, projectId);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ action: "submission:lock", entityType: "WeeklySubmission" });
  });

  it("includes entries tagged to one of the project's notes", async () => {
    await writeAuditLog(prisma, { companyId, actorId: userId, action: "note:amend", entityType: "UncertaintyNote", entityId: noteId });
    const trail = await getProjectAuditTrail(prisma, projectId);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ action: "note:amend", entityType: "UncertaintyNote" });
  });

  it("excludes entries belonging to a different project in the same company", async () => {
    await writeAuditLog(prisma, { companyId, actorId: userId, action: "project:update", entityType: "Project", entityId: otherProjectId });
    const trail = await getProjectAuditTrail(prisma, projectId);
    expect(trail).toHaveLength(0);
  });

  it("shows a null actorName for a system-initiated entry", async () => {
    await writeAuditLog(prisma, { companyId, actorId: null, action: "submission:lock", entityType: "WeeklySubmission", entityId: submissionId, reason: "auto-lock" });
    const trail = await getProjectAuditTrail(prisma, projectId);
    expect(trail[0].actorName).toBeNull();
    expect(trail[0].reason).toBe("auto-lock");
  });

  it("orders entries oldest first", async () => {
    await writeAuditLog(prisma, { companyId, actorId: userId, action: "project:update", entityType: "Project", entityId: projectId, reason: "first" });
    await writeAuditLog(prisma, { companyId, actorId: userId, action: "project:update", entityType: "Project", entityId: projectId, reason: "second" });
    const trail = await getProjectAuditTrail(prisma, projectId);
    expect(trail.map((e) => e.reason)).toEqual(["first", "second"]);
  });
});
