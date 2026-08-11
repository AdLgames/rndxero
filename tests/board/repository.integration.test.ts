import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { BoardError, getBoardData, remapNote } from "@/lib/board/repository";
import { createPlanVersion } from "@/lib/plan/repository";

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

  describe("getBoardData", () => {
    it("returns the requested week window as column keys, in order", async () => {
      const data = await getBoardData(prisma, { companyId, projectIds: [projectId], fromWeekKey: "2026-W30", weekCount: 4 });
      expect(data.weekKeys).toEqual(["2026-W30", "2026-W31", "2026-W32", "2026-W33"]);
    });

    it("only includes lanes for the requested projects within this company", async () => {
      const data = await getBoardData(prisma, { companyId, projectIds: [projectId], fromWeekKey: "2026-W30", weekCount: 4 });
      expect(data.lanes.map((l) => l.projectId)).toEqual([projectId]);
    });

    it("aggregates planned minutes from the current plan version, within the window only", async () => {
      await createPlanVersion(prisma, {
        projectId,
        createdById: userId,
        allocations: [
          { uncertaintyId: uncertaintyAId, weekKey: "2026-W30", plannedMinutes: 300 },
          { uncertaintyId: uncertaintyBId, weekKey: "2026-W30", plannedMinutes: 120 },
          { uncertaintyId: uncertaintyAId, weekKey: "2026-W50", plannedMinutes: 600 }, // outside the window
        ],
      });

      const data = await getBoardData(prisma, { companyId, projectIds: [projectId], fromWeekKey: "2026-W30", weekCount: 4 });
      const lane = data.lanes[0];
      expect(lane.plannedMinutesByWeek["2026-W30"]).toBe(420);
      expect(lane.plannedMinutesByWeek["2026-W50"]).toBeUndefined();
    });

    it("sums actual minutes per week and groups notes per week with the parent submission's lock state", async () => {
      const submission = await prisma.weeklySubmission.create({
        data: { companyId, projectId, userId, weekKey: "2026-W31", minutes: 240, basis: "TRACKED", isRetrospective: false, lockedAt: new Date() },
      });
      await prisma.uncertaintyNote.create({
        data: { submissionId: submission.id, uncertaintyId: uncertaintyAId, type: "FAILED_ATTEMPT", body: "Cache thrashed under load" },
      });
      await prisma.uncertaintyNote.create({
        data: { submissionId: submission.id, uncertaintyId: uncertaintyBId, type: "ATTEMPT", body: "Tried streaming" },
      });

      const data = await getBoardData(prisma, { companyId, projectIds: [projectId], fromWeekKey: "2026-W30", weekCount: 4 });
      const lane = data.lanes[0];
      expect(lane.actualMinutesByWeek["2026-W31"]).toBe(240);
      expect(lane.notesByWeek["2026-W31"]).toHaveLength(2);
      expect(lane.notesByWeek["2026-W31"].every((n) => n.locked)).toBe(true);
      expect(lane.notesByWeek["2026-W31"].map((n) => n.type).sort()).toEqual(["ATTEMPT", "FAILED_ATTEMPT"]);
    });

    it("leaves a week absent from the maps entirely when nothing touched it (the visible gap)", async () => {
      const data = await getBoardData(prisma, { companyId, projectIds: [projectId], fromWeekKey: "2026-W30", weekCount: 4 });
      const lane = data.lanes[0];
      expect(lane.actualMinutesByWeek["2026-W32"]).toBeUndefined();
      expect(lane.notesByWeek["2026-W32"]).toBeUndefined();
    });

    it("excludes submissions for a project outside the requested set even in the same company", async () => {
      await prisma.weeklySubmission.create({
        data: { companyId, projectId: otherProjectId, userId, weekKey: "2026-W30", minutes: 100, basis: "ESTIMATED", isRetrospective: false },
      });
      const data = await getBoardData(prisma, { companyId, projectIds: [projectId], fromWeekKey: "2026-W30", weekCount: 4 });
      expect(data.lanes).toHaveLength(1);
      expect(data.lanes[0].projectId).toBe(projectId);
    });
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
