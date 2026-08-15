import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { BoardError, remapNote } from "@/lib/board/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("board repository (integration)", () => {
  let companyId: string;
  let projectId: string;
  let otherProjectId: string;
  let userId: string;
  let uncertaintyAId: string;
  let uncertaintyBId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditLog", "PlannedAllocation", "PlanVersion", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const user = await prisma.user.create({ data: { email: "lead@example.com", name: "Lead" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({ data: { companyId, name: "Widget Engine", startDate: new Date() } });
    projectId = project.id;
    const otherProject = await prisma.project.create({ data: { companyId, name: "Other Project", startDate: new Date() } });
    otherProjectId = otherProject.id;
    const uncertaintyA = await prisma.uncertainty.create({
      data: { projectId, title: "Will the cache scale?", baseline: "b", raisedWeek: "2026-W30" },
    });
    uncertaintyAId = uncertaintyA.id;
    const uncertaintyB = await prisma.uncertainty.create({
      data: { projectId, title: "Can we stream results?", baseline: "b", raisedWeek: "2026-W30" },
    });
    uncertaintyBId = uncertaintyB.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditLog", "PlannedAllocation", "PlanVersion", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  describe("remapNote", () => {
    async function createLiveNote() {
      const submission = await prisma.weeklySubmission.create({
        data: { companyId, projectId, userId, weekKey: "2026-W31", minutes: 120, basis: "ESTIMATED", isRetrospective: false },
      });
      return prisma.uncertaintyNote.create({
        data: { submissionId: submission.id, uncertaintyId: uncertaintyAId, type: "ATTEMPT", body: "Tried X" },
      });
    }

    it("reassigns a live note to a different uncertainty and audit-logs the move", async () => {
      const note = await createLiveNote();

      const updated = await remapNote(prisma, { noteId: note.id, companyId, actorId: userId, toUncertaintyId: uncertaintyBId });
      expect(updated.uncertaintyId).toBe(uncertaintyBId);

      const logs = await prisma.auditLog.findMany({ where: { entityId: note.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("note.remap");
      expect(logs[0].before).toEqual({ uncertaintyId: uncertaintyAId });
      expect(logs[0].after).toEqual({ uncertaintyId: uncertaintyBId });
    });

    it("is a no-op with no audit log when remapping to the same uncertainty", async () => {
      const note = await createLiveNote();
      await remapNote(prisma, { noteId: note.id, companyId, actorId: userId, toUncertaintyId: uncertaintyAId });
      const logs = await prisma.auditLog.findMany({ where: { entityId: note.id } });
      expect(logs).toHaveLength(0);
    });

    it("refuses to remap a note whose parent submission is locked", async () => {
      const note = await createLiveNote();
      await prisma.weeklySubmission.update({ where: { id: note.submissionId }, data: { lockedAt: new Date() } });

      await expect(
        remapNote(prisma, { noteId: note.id, companyId, actorId: userId, toUncertaintyId: uncertaintyBId })
      ).rejects.toThrow(BoardError);
    });

    it("refuses to remap into an uncertainty from a different project", async () => {
      const note = await createLiveNote();
      const foreignUncertainty = await prisma.uncertainty.create({
        data: { projectId: otherProjectId, title: "Foreign", baseline: "b", raisedWeek: "2026-W30" },
      });

      await expect(
        remapNote(prisma, { noteId: note.id, companyId, actorId: userId, toUncertaintyId: foreignUncertainty.id })
      ).rejects.toThrow(BoardError);
    });

    it("throws for a note that does not exist", async () => {
      await expect(
        remapNote(prisma, { noteId: "does-not-exist", companyId, actorId: userId, toUncertaintyId: uncertaintyAId })
      ).rejects.toThrow(BoardError);
    });
  });
});
