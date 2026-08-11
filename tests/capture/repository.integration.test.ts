import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createUncertainty,
  getCaptureSnapshot,
  getOpenUncertainties,
  getPrefillMinutes,
  submitWeek,
} from "@/lib/capture/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("capture repository (integration)", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
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
      'TRUNCATE "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("creates an uncertainty with its baseline and raised week", async () => {
    const uncertainty = await createUncertainty(prisma, {
      projectId,
      title: "Will the new index scale?",
      baseline: "We didn't know if a composite index would hold under 10x write volume.",
      weekKey: "2026-W33",
    });
    expect(uncertainty.outcome).toBe("OPEN");
    expect(uncertainty.raisedWeek).toBe("2026-W33");
  });

  it("lists only OPEN uncertainties", async () => {
    await createUncertainty(prisma, {
      projectId,
      title: "Open one",
      baseline: "b",
      weekKey: "2026-W33",
    });
    const resolved = await createUncertainty(prisma, {
      projectId,
      title: "Resolved one",
      baseline: "b",
      weekKey: "2026-W32",
    });
    await prisma.uncertainty.update({
      where: { id: resolved.id },
      data: { outcome: "RESOLVED", resolvedWeek: "2026-W33" },
    });

    const open = await getOpenUncertainties(prisma, projectId);
    expect(open.map((u) => u.title)).toEqual(["Open one"]);
  });

  it("submitWeek creates a submission and its notes together", async () => {
    const uncertainty = await createUncertainty(prisma, {
      projectId,
      title: "Uncertainty",
      baseline: "b",
      weekKey: "2026-W33",
    });

    const submission = await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W33",
      minutes: 300,
      basis: "ESTIMATED",
      notes: [{ uncertaintyId: uncertainty.id, type: "ATTEMPT", body: "Tried a composite index" }],
    });

    expect(submission.minutes).toBe(300);
    expect(submission.isRetrospective).toBe(false);

    const notes = await prisma.uncertaintyNote.findMany({ where: { submissionId: submission.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("ATTEMPT");
  });

  it("resubmitting the same week updates minutes without duplicating the row", async () => {
    await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W33",
      minutes: 120,
      basis: "ESTIMATED",
      notes: [],
    });
    const updated = await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W33",
      minutes: 180,
      basis: "TRACKED",
      notes: [],
    });

    const all = await prisma.weeklySubmission.findMany({ where: { projectId, userId, weekKey: "2026-W33" } });
    expect(all).toHaveLength(1);
    expect(updated.minutes).toBe(180);
    expect(updated.basis).toBe("TRACKED");
  });

  it("does not rewrite submittedAt/isRetrospective on a later correction", async () => {
    const first = await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W33",
      minutes: 120,
      basis: "ESTIMATED",
      notes: [],
    });
    const second = await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W33",
      minutes: 150,
      basis: "ESTIMATED",
      notes: [],
    });

    expect(second.submittedAt.getTime()).toBe(first.submittedAt.getTime());
    expect(second.isRetrospective).toBe(first.isRetrospective);
  });

  it("rejects resubmitting a week that is already locked", async () => {
    const submission = await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W33",
      minutes: 120,
      basis: "ESTIMATED",
      notes: [],
    });
    await prisma.weeklySubmission.update({ where: { id: submission.id }, data: { lockedAt: new Date() } });

    await expect(
      submitWeek(prisma, {
        companyId,
        projectId,
        userId,
        weekKey: "2026-W33",
        minutes: 999,
        basis: "ESTIMATED",
        notes: [],
      })
    ).rejects.toThrow(/append-only violation/);
  });

  it("prefills from the previous week's minutes", async () => {
    await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W32",
      minutes: 240,
      basis: "TRACKED",
      notes: [],
    });

    const prefill = await getPrefillMinutes(prisma, { projectId, userId, previousWeekKey: "2026-W32" });
    expect(prefill).toBe(240);
  });

  it("returns null prefill when there is no previous submission", async () => {
    const prefill = await getPrefillMinutes(prisma, { projectId, userId, previousWeekKey: "2026-W01" });
    expect(prefill).toBeNull();
  });

  it("captures a running snapshot across weeks", async () => {
    await createUncertainty(prisma, { projectId, title: "Open", baseline: "b", weekKey: "2026-W33" });
    await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W32",
      minutes: 100,
      basis: "ESTIMATED",
      notes: [],
    });
    await submitWeek(prisma, {
      companyId,
      projectId,
      userId,
      weekKey: "2026-W33",
      minutes: 150,
      basis: "ESTIMATED",
      notes: [],
    });

    const snapshot = await getCaptureSnapshot(prisma, { projectId, userId });
    expect(snapshot).toEqual({ weeksLogged: 2, openUncertainties: 1, totalMinutes: 250 });
  });
});
