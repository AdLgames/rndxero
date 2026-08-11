import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getWeekBoundaries } from "@/lib/capture/week-key";
import { autoLockOverdueSubmissions, lockSubmission, LockingError, unlockSubmission } from "@/lib/locking/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("locking repository (integration)", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditLog", "WeeklySubmission", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({
      data: { companyId, name: "Test Project", startDate: new Date() },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditLog", "WeeklySubmission", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  async function createSubmission(overrides: Partial<{ weekKey: string; minutes: number; lockedAt: Date | null }> = {}) {
    return prisma.weeklySubmission.create({
      data: {
        companyId,
        projectId,
        userId,
        weekKey: overrides.weekKey ?? "2026-W33",
        minutes: overrides.minutes ?? 120,
        basis: "ESTIMATED",
        isRetrospective: false,
        lockedAt: overrides.lockedAt ?? null,
      },
    });
  }

  describe("lockSubmission", () => {
    it("locks an unlocked submission and writes an audit log", async () => {
      const submission = await createSubmission();

      const locked = await lockSubmission(prisma, { submissionId: submission.id, companyId, actorId: userId });

      expect(locked.lockedAt).not.toBeNull();

      const logs = await prisma.auditLog.findMany({ where: { entityId: submission.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("submission.lock");
      expect(logs[0].actorId).toBe(userId);
    });

    it("refuses to lock a submission that is already locked", async () => {
      const submission = await createSubmission({ lockedAt: new Date() });

      await expect(
        lockSubmission(prisma, { submissionId: submission.id, companyId, actorId: userId })
      ).rejects.toThrow(LockingError);
    });

    it("refuses to lock a submission that does not exist", async () => {
      await expect(
        lockSubmission(prisma, { submissionId: "does-not-exist", companyId, actorId: userId })
      ).rejects.toThrow(LockingError);
    });
  });

  describe("unlockSubmission", () => {
    it("requires a non-empty reason", async () => {
      const submission = await createSubmission({ lockedAt: new Date() });

      await expect(
        unlockSubmission(prisma, { submissionId: submission.id, companyId, actorId: userId, reason: "   " })
      ).rejects.toThrow(/reason is required/);
    });

    it("unlocks a locked submission and writes an audit log with the reason", async () => {
      const submission = await createSubmission({ lockedAt: new Date() });

      const unlocked = await unlockSubmission(prisma, {
        submissionId: submission.id,
        companyId,
        actorId: userId,
        reason: "Engineer flagged a transcription error",
      });

      expect(unlocked.lockedAt).toBeNull();

      const logs = await prisma.auditLog.findMany({ where: { entityId: submission.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("submission.unlock");
      expect(logs[0].reason).toBe("Engineer flagged a transcription error");
    });

    it("refuses to unlock a submission that is not locked", async () => {
      const submission = await createSubmission({ lockedAt: null });

      await expect(
        unlockSubmission(prisma, { submissionId: submission.id, companyId, actorId: userId, reason: "why not" })
      ).rejects.toThrow(LockingError);
    });
  });

  describe("autoLockOverdueSubmissions", () => {
    it("locks only submissions past their week's close + grace period, with a null actor", async () => {
      const overdueWeek = "2026-W20"; // long closed relative to `now` below
      const recentWeek = "2026-W33";
      const overdue = await createSubmission({ weekKey: overdueWeek });
      const recent = await createSubmission({ weekKey: recentWeek, minutes: 60 });
      // second user so the (projectId, userId, weekKey) unique constraint doesn't collide
      const otherUser = await prisma.user.create({ data: { email: "other@example.com", name: "Other" } });
      await prisma.weeklySubmission.create({
        data: {
          companyId,
          projectId,
          userId: otherUser.id,
          weekKey: recentWeek,
          minutes: 60,
          basis: "ESTIMATED",
          isRetrospective: false,
        },
      });

      const now = new Date(getWeekBoundaries(recentWeek).end.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day past recent week's close

      const result = await autoLockOverdueSubmissions(prisma, { now });

      expect(result.lockedCount).toBe(1);

      const overdueAfter = await prisma.weeklySubmission.findUniqueOrThrow({ where: { id: overdue.id } });
      const recentAfter = await prisma.weeklySubmission.findUniqueOrThrow({ where: { id: recent.id } });
      expect(overdueAfter.lockedAt).not.toBeNull();
      expect(recentAfter.lockedAt).toBeNull();

      const logs = await prisma.auditLog.findMany({ where: { entityId: overdue.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("submission.auto_lock");
      expect(logs[0].actorId).toBeNull();
    });

    it("is idempotent: a second run does not re-lock or re-log an already-locked row", async () => {
      const submission = await createSubmission({ weekKey: "2026-W20" });
      const now = new Date(getWeekBoundaries("2026-W20").end.getTime() + 30 * 24 * 60 * 60 * 1000);

      await autoLockOverdueSubmissions(prisma, { now });
      const second = await autoLockOverdueSubmissions(prisma, { now });

      expect(second.lockedCount).toBe(0);
      const logs = await prisma.auditLog.findMany({ where: { entityId: submission.id } });
      expect(logs).toHaveLength(1);
    });
  });
});
