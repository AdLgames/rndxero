import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { recordTimeEntry } from "@/lib/time/repository";
import {
  decideApproval,
  getPendingApprovalQueue,
  getProjectTimeEvidenceSummary,
} from "@/lib/approvals/repository";
import { InvalidApprovalTransitionError } from "@/lib/approvals/state-machine";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("approvals repository (integration)", () => {
  let personId: string;
  let approverId: string;
  let projectId: string;
  let companyId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Approval", "TimeEntry", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const person = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    personId = person.id;
    const approver = await prisma.user.create({ data: { email: "fin@example.com", name: "Fin" } });
    approverId = approver.id;

    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({
      data: { companyId: company.id, name: "Test Project", startDate: new Date() },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Approval", "TimeEntry", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("shows a fresh time entry as unevidenced until approved", async () => {
    const entry = await recordTimeEntry(prisma, {
      projectId,
      personId,
      periodStart: new Date("2026-08-10"),
      periodEnd: new Date("2026-08-17"),
      minutes: 120,
      basis: "ESTIMATED",
      authorId: personId,
    });

    const before = await getProjectTimeEvidenceSummary(prisma, projectId);
    expect(before).toEqual({ totalMinutes: 120, approvedMinutes: 0, unevidencedMinutes: 120 });

    await decideApproval(prisma, {
      targetType: "TIME_ENTRY",
      targetId: entry.id,
      action: "approve",
      approverId,
      snapshotData: entry,
    });

    const after = await getProjectTimeEvidenceSummary(prisma, projectId);
    expect(after).toEqual({ totalMinutes: 120, approvedMinutes: 120, unevidencedMinutes: 0 });
  });

  it("rejects approving an already-approved entry", async () => {
    const entry = await recordTimeEntry(prisma, {
      projectId,
      personId,
      periodStart: new Date("2026-08-10"),
      periodEnd: new Date("2026-08-17"),
      minutes: 60,
      basis: "TIMESHEET",
      authorId: personId,
    });

    await decideApproval(prisma, {
      targetType: "TIME_ENTRY",
      targetId: entry.id,
      action: "approve",
      approverId,
      snapshotData: entry,
    });

    await expect(
      decideApproval(prisma, {
        targetType: "TIME_ENTRY",
        targetId: entry.id,
        action: "approve",
        approverId,
        snapshotData: entry,
      })
    ).rejects.toThrow(InvalidApprovalTransitionError);
  });

  it("lists a pending entry in the queue and removes it once decided", async () => {
    const entry = await recordTimeEntry(prisma, {
      projectId,
      personId,
      periodStart: new Date("2026-08-10"),
      periodEnd: new Date("2026-08-17"),
      minutes: 90,
      basis: "SAMPLED",
      authorId: personId,
    });

    const before = await getPendingApprovalQueue(prisma, companyId);
    expect(before).toHaveLength(1);
    expect(before[0].targetId).toBe(entry.id);

    await decideApproval(prisma, {
      targetType: "TIME_ENTRY",
      targetId: entry.id,
      action: "query",
      approverId,
      comment: "Which sprint was this?",
      snapshotData: entry,
    });

    const after = await getPendingApprovalQueue(prisma, companyId);
    expect(after).toHaveLength(0);
  });
});
