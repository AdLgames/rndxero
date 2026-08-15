import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addAmendment, AmendmentError } from "@/lib/locking/amendment";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("addAmendment (integration)", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;
  let submissionId: string;
  let noteId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditLog", "Amendment", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({
      data: { companyId, name: "Test Project", startDate: new Date() },
    });
    projectId = project.id;
    const uncertainty = await prisma.uncertainty.create({
      data: { projectId, title: "Will it scale?", baseline: "b", raisedWeek: "2026-W33" },
    });
    const submission = await prisma.weeklySubmission.create({
      data: {
        companyId,
        projectId,
        userId,
        weekKey: "2026-W33",
        minutes: 120,
        basis: "ESTIMATED",
        isRetrospective: false,
        lockedAt: new Date(),
      },
    });
    submissionId = submission.id;
    const note = await prisma.uncertaintyNote.create({
      data: { submissionId, uncertaintyId: uncertainty.id, type: "ATTEMPT", body: "Tried an index" },
    });
    noteId = note.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditLog", "Amendment", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("appends a correction to a note without touching the original", async () => {
    const amendment = await addAmendment(prisma, { noteId, companyId, authorId: userId, body: "Actually it was a hash index" });

    expect(amendment.noteId).toBe(noteId);
    expect(amendment.submissionId).toBeNull();

    const originalNote = await prisma.uncertaintyNote.findUniqueOrThrow({ where: { id: noteId } });
    expect(originalNote.body).toBe("Tried an index");
  });

  it("appends a correction to a submission without touching the original", async () => {
    const amendment = await addAmendment(prisma, { submissionId, companyId, authorId: userId, body: "Minutes should be 150" });

    expect(amendment.submissionId).toBe(submissionId);
    expect(amendment.noteId).toBeNull();

    const originalSubmission = await prisma.weeklySubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(originalSubmission.minutes).toBe(120);
  });

  it("rejects an empty body", async () => {
    await expect(addAmendment(prisma, { noteId, companyId, authorId: userId, body: "   " })).rejects.toThrow(AmendmentError);
  });

  it("writes an audit log entry attributed to the amending user", async () => {
    const amendment = await addAmendment(prisma, { noteId, companyId, authorId: userId, body: "Actually it was a hash index" });

    const entries = await prisma.auditLog.findMany({ where: { companyId, entityId: noteId } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorId: userId, action: "note:amend", entityType: "UncertaintyNote" });
    expect((entries[0].after as { amendmentId?: string })?.amendmentId).toBe(amendment.id);
  });

  it("a note can carry more than one amendment, all retained", async () => {
    await addAmendment(prisma, { noteId, companyId, authorId: userId, body: "First correction" });
    await addAmendment(prisma, { noteId, companyId, authorId: userId, body: "Second correction" });

    const amendments = await prisma.amendment.findMany({ where: { noteId }, orderBy: { createdAt: "asc" } });
    expect(amendments.map((a) => a.body)).toEqual(["First correction", "Second correction"]);
  });
});
