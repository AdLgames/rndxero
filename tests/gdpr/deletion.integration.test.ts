import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  anonymizeUser,
  cancelAccountDeletionRequest,
  DELETION_GRACE_DAYS,
  DeletionError,
  processPendingDeletions,
  requestAccountDeletion,
} from "@/lib/gdpr/deletion";
import { exportUserData } from "@/lib/gdpr/export";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE =
  'TRUNCATE "AuditLog", "SubmissionComment", "Amendment", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Membership", "Company", "User" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("GDPR deletion (integration)", () => {
  let companyId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const user = await prisma.user.create({ data: { email: "worker@example.com", name: "Real Name" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    await prisma.membership.create({ data: { userId, companyId, role: "CONTRIBUTOR", status: "ACTIVE" } });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("sets deletionRequestedAt on request and clears it on cancel", async () => {
    const requested = await requestAccountDeletion(prisma, userId);
    expect(requested.deletionRequestedAt).not.toBeNull();

    const cancelled = await cancelAccountDeletionRequest(prisma, userId);
    expect(cancelled.deletionRequestedAt).toBeNull();
  });

  it("is idempotent — requesting twice keeps the original timestamp", async () => {
    const first = await requestAccountDeletion(prisma, userId);
    const second = await requestAccountDeletion(prisma, userId);
    expect(second.deletionRequestedAt).toEqual(first.deletionRequestedAt);
  });

  it("anonymizeUser wipes name/email but keeps the row and its id", async () => {
    const project = await prisma.project.create({ data: { companyId, name: "Project A", startDate: new Date() } });
    const submission = await prisma.weeklySubmission.create({
      data: { companyId, projectId: project.id, userId, weekKey: "2026-W30", minutes: 60, basis: "TRACKED", isRetrospective: false },
    });

    const anonymized = await anonymizeUser(prisma, userId);
    expect(anonymized.id).toBe(userId);
    expect(anonymized.name).toBe("Removed user");
    expect(anonymized.email).not.toBe("worker@example.com");
    expect(anonymized.email).toContain(userId);

    // The evidence itself is untouched — still points at the same user id.
    const stillThere = await prisma.weeklySubmission.findUnique({ where: { id: submission.id } });
    expect(stillThere?.userId).toBe(userId);
  });

  it("anonymizeUser writes an audit log entry per company membership", async () => {
    await anonymizeUser(prisma, userId);
    const logs = await prisma.auditLog.findMany({ where: { entityType: "User", entityId: userId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: "user:anonymize", companyId, actorId: null });
  });

  it("anonymizeUser is idempotent", async () => {
    const first = await anonymizeUser(prisma, userId);
    const second = await anonymizeUser(prisma, userId);
    expect(second.email).toBe(first.email);
  });

  it("rejects a new deletion request for an already-anonymized account", async () => {
    await anonymizeUser(prisma, userId);
    await expect(requestAccountDeletion(prisma, userId)).rejects.toThrow(DeletionError);
  });

  it("processPendingDeletions only processes requests past the grace period", async () => {
    await prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date() } });
    const tooSoon = await processPendingDeletions(prisma, { now: new Date() });
    expect(tooSoon.anonymizedCount).toBe(0);

    const afterGrace = new Date(Date.now() + (DELETION_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);
    const due = await processPendingDeletions(prisma, { now: afterGrace });
    expect(due.anonymizedCount).toBe(1);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.name).toBe("Removed user");
  });

  it("exportUserData includes profile and contributed records, and stops once anonymized", async () => {
    const project = await prisma.project.create({ data: { companyId, name: "Project A", startDate: new Date() } });
    await prisma.weeklySubmission.create({
      data: { companyId, projectId: project.id, userId, weekKey: "2026-W30", minutes: 90, basis: "TRACKED", isRetrospective: false },
    });

    const before = await exportUserData(prisma, userId);
    expect(before.profile.email).toBe("worker@example.com");
    expect(before.weeklySubmissions).toHaveLength(1);
    expect(before.weeklySubmissions[0]).toMatchObject({ projectName: "Project A", minutes: 90 });

    await anonymizeUser(prisma, userId);
    const after = await exportUserData(prisma, userId);
    expect(after.profile.name).toBe("Removed user");
    // The contribution itself is still theirs to export, unaffected by anonymization.
    expect(after.weeklySubmissions).toHaveLength(1);
  });
});
